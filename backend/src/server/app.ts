import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { Agent } from "../core/agent.js";
import type { FunctionCallContextItem, State } from "../core/models/state.js";
import { createInitialState } from "../core/models/state.js";
import { StateStore } from "./database.js";

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export interface AppDependencies {
  agent?: Agent;
  store?: StateStore;
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function createApp(dependencies: AppDependencies = {}): express.Express {
  const app = express();
  const store = dependencies.store ?? new StateStore();
  const agent = dependencies.agent ?? new Agent({ maxSteps: 10 });

  app.use(cors({ origin: "*", credentials: false }));
  app.use(express.json());

  app.post(
    "/agent/launch",
    asyncHandler(async (request, response) => {
      const inputPrompt = requireStringField(request.body, "input_prompt");
      const initialState = createInitialState(randomUUID(), inputPrompt);

      store.save(initialState);
      void runAgentInBackground(store, agent, initialState.id);

      response.json(initialState);
    })
  );

  app.get(
    "/agent/state/:stateId",
    asyncHandler(async (request, response) => {
      const stateId = requireRouteParam(request.params.stateId, "stateId");
      const state = store.get(stateId);
      if (!state) {
        throw new HttpError(404, "State not found");
      }

      response.json(state);
    })
  );

  app.post(
    "/agent/provide_input",
    asyncHandler(async (request, response) => {
      const id = requireStringField(request.body, "id");
      const answer = requireStringField(request.body, "answer");
      const current = store.get(id);

      if (!current) {
        throw new HttpError(404, "State not found");
      }

      if (current.status !== "waiting_human_input") {
        throw new HttpError(400, `State is not waiting for human input. Current status: ${current.status}`);
      }

      const callId = getAskHumanCallId(current);
      if (!callId) {
        throw new HttpError(400, "Could not find ask_human call in state context");
      }

      const workingState: State = {
        ...current,
        context: [
          ...current.context,
          {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ answer })
          }
        ]
      };

      store.save({ ...workingState, status: "running" });
      void runAgentInBackground(store, agent, id, workingState);

      response.json(workingState);
    })
  );

  app.post(
    "/agent/pause",
    asyncHandler(async (request, response) => {
      const id = requireStringField(request.body, "id");
      const updated = store.update(id, (state) => {
        if (state.status !== "running") {
          throw new HttpError(
            400,
            `Cannot pause agent. Current status: ${state.status}. Only agents with status 'running' can be paused.`
          );
        }

        return { ...state, status: "paused" };
      });

      if (!updated) {
        throw new HttpError(404, "State not found");
      }

      response.json(updated);
    })
  );

  app.post(
    "/agent/resume",
    asyncHandler(async (request, response) => {
      const id = requireStringField(request.body, "id");
      const current = store.get(id);

      if (!current) {
        throw new HttpError(404, "State not found");
      }

      if (current.status === "running") {
        throw new HttpError(409, "Agent is already running for this state");
      }

      if (current.status === "waiting_human_input") {
        throw new HttpError(400, "Agent is waiting for human input");
      }

      const workingState = store.save({ ...current, error: null });
      void runAgentInBackground(store, agent, id, workingState);

      response.json(workingState);
    })
  );

  app.use((_request, _response, next) => {
    next(new HttpError(404, "Not found"));
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : String(error);
    response.status(statusCode).json({ detail: message });
  });

  return app;
}

async function runAgentInBackground(
  store: StateStore,
  agent: Agent,
  stateId: string,
  workingState?: State
): Promise<void> {
  try {
    let initialState = workingState;
    if (!initialState) {
      const persisted = store.get(stateId);
      if (!persisted) {
        return;
      }

      initialState = store.save({ ...persisted, status: "running", error: null });
    } else {
      store.save({ ...initialState, status: "running", error: null });
    }

    const finalState = await agent.run(initialState, async (state) => {
      const persisted = store.get(stateId);
      if (persisted?.status === "paused") {
        state.status = "paused";
        store.save({
          ...state,
          status: "paused"
        });
        return;
      }

      store.save(state);
    });

    store.save(finalState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const state = store.get(stateId);
    if (state) {
      store.save({
        ...state,
        status: "failed",
        error: message,
        pending_tool_calls: []
      });
    }
  }
}

function asyncHandler(route: AsyncRoute): AsyncRoute {
  return async (request, response, next) => {
    try {
      await route(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}

function requireStringField(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be an object");
  }

  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${field} must be a non-empty string`);
  }

  return value;
}

function requireRouteParam(value: string | string[] | undefined, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${field} must be a non-empty string`);
  }

  return value;
}

function getAskHumanCallId(state: State): string | null {
  for (const item of [...state.context].reverse()) {
    if (isAskHumanFunctionCall(item)) {
      return item.call_id;
    }
  }

  return null;
}

function isAskHumanFunctionCall(value: unknown): value is FunctionCallContextItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "function_call" &&
    "name" in value &&
    value.name === "ask_human" &&
    "call_id" in value &&
    typeof value.call_id === "string"
  );
}

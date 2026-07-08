import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { Agent } from "../core/agent.js";
import type { ContextItem, State } from "../core/models/state.js";
import { StateStore } from "./database.js";

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

const store = new StateStore();
const agent = new Agent({ maxSteps: 10 });

export const app = express();

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json());

app.post(
  "/agent/launch",
  asyncHandler(async (request, response) => {
    const inputPrompt = requireStringField(request.body, "input_prompt");
    // Build the unified, persistable State record (Factor 5); the agent core
    // itself stays a State-in/State-out reducer (Factor 12)
    const initialState: State = {
      id: randomUUID(),
      steps: 0,
      status: "running",
      context: [{ role: "user", content: inputPrompt }],
      pending_tool_calls: [],
      error: null,
      final_answer: null
    };

    store.save(initialState);
    void runAgentInBackground(initialState.id);

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
  "/agent/pause",
  asyncHandler(async (request, response) => {
    const id = requireStringField(request.body, "id");
    // Factor 6: Pause is a simple state transition in the DB.
    // The background loop checks this status in its progress callback.
    const updated = store.update(id, (state) => {
      if (state.status !== "running") {
        throw new HttpError(400, `Cannot pause agent. Current status: ${state.status}`);
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
      throw new HttpError(409, "Agent is already running");
    }

    // A waiting agent must receive human input, not a blind resume (Factor 7)
    if (current.status === "waiting_human_input") {
      throw new HttpError(400, "Agent is waiting for human input");
    }

    // Factor 6: Resume transitions the state back to 'running' and restarts the loop
    const workingState = store.save({ ...current, status: "running", error: null });
    void runAgentInBackground(id, workingState);

    response.json(workingState);
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

    // Match the human's answer to the original ask_human tool call (Factor 7)
    const callId = getAskHumanCallId(current);
    if (!callId) {
      throw new HttpError(400, "Could not find ask_human call in state context");
    }

    // Human input is modeled as a function_call_output — the response half of
    // the ask_human tool-call/response pair
    const humanResponse: ContextItem = {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify({ answer })
    };

    const workingState: State = {
      ...current,
      status: "running",
      context: [...current.context, humanResponse]
    };

    store.save(workingState);
    void runAgentInBackground(id, workingState);

    response.json(workingState);
  })
);

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : String(error);
  response.status(statusCode).json({ detail: message });
});

async function runAgentInBackground(stateId: string, workingState?: State): Promise<void> {
  try {
    const state = workingState ?? store.get(stateId);
    if (!state) return;

    // The progress callback allows us to stop the agent if the status changes to 'paused'
    const finalState = await agent.run(state, async (updatedState) => {
      const persisted = store.get(stateId);
      if (persisted?.status === "paused") {
        // If an API call changed the DB status to 'paused', we stop the agent loop
        updatedState.status = "paused";
        store.save(updatedState);
        return;
      }
      store.save(updatedState);
    });

    store.save(finalState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const state = store.get(stateId);
    if (state) {
      store.save({ ...state, status: "failed", error: message, pending_tool_calls: [] });
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

// Scan context backwards for the most recent ask_human call so the human's
// answer can be paired with the correct call_id
function getAskHumanCallId(state: State): string | null {
  for (const item of [...state.context].reverse()) {
    if ("type" in item && item.type === "function_call" && item.name === "ask_human") {
      return item.call_id;
    }
  }
  return null;
}

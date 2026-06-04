import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import { Agent } from "../core/agent.js";
import type { FunctionCallContextItem, State } from "../core/models/state.js";
import { createInitialState } from "../core/models/state.js";
import { HttpError, assertObject, readJsonBody, requireStringField, sendJson, sendOptions } from "./http.js";
import { StateStore } from "./database.js";

const terminalStatuses = new Set(["complete", "failed"]);
const port = Number(process.env.PORT ?? 8000);
const host = process.env.HOST ?? "0.0.0.0";

const store = new StateStore();
const agent = new Agent({ maxSteps: 10 });

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      sendOptions(response);
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "POST" && url.pathname === "/agent/launch") {
      const body = await readJsonBody(request);
      assertObject(body);
      const inputPrompt = requireStringField(body, "input_prompt");
      const initialState = createInitialState(randomUUID(), inputPrompt);

      store.save(initialState);
      void runAgentInBackground(initialState.id);

      sendJson(response, 200, initialState);
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/agent/state/")) {
      const stateId = decodeURIComponent(url.pathname.replace("/agent/state/", ""));
      const state = store.get(stateId);
      if (!state) {
        throw new HttpError(404, "State not found");
      }

      sendJson(response, 200, state);
      return;
    }

    if (request.method === "POST" && url.pathname === "/agent/pause") {
      const body = await readJsonBody(request);
      assertObject(body);
      const id = requireStringField(body, "id");

      const updated = store.update(id, (state) => {
        if (state.status !== "running") {
          throw new HttpError(
            400,
            `Cannot pause agent. Current status: ${state.status}. Only running agents can be paused.`
          );
        }

        return { ...state, status: "paused" };
      });

      if (!updated) {
        throw new HttpError(404, "State not found");
      }

      sendJson(response, 200, updated);
      return;
    }

    if (request.method === "POST" && url.pathname === "/agent/resume") {
      const body = await readJsonBody(request);
      assertObject(body);
      const id = requireStringField(body, "id");
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

      if (terminalStatuses.has(current.status)) {
        throw new HttpError(400, `Cannot resume a terminal state: ${current.status}`);
      }

      const workingState = store.save({ ...current, status: "running", error: null });
      void runAgentInBackground(id, workingState);

      sendJson(response, 200, workingState);
      return;
    }

    if (request.method === "POST" && url.pathname === "/agent/provide_input") {
      const body = await readJsonBody(request);
      assertObject(body);
      const id = requireStringField(body, "id");
      const answer = requireStringField(body, "answer");
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
        status: "running",
        context: [
          ...current.context,
          {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ answer })
          }
        ]
      };

      store.save(workingState);
      void runAgentInBackground(id, workingState);

      sendJson(response, 200, workingState);
      return;
    }

    throw new HttpError(404, "Not found");
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, statusCode, { detail: message });
  }
});

server.listen(port, host, () => {
  console.log(`Backend API listening on http://${host}:${port}`);
});

async function runAgentInBackground(stateId: string, workingState?: State): Promise<void> {
  try {
    const initialState = workingState ?? store.get(stateId);
    if (!initialState) {
      return;
    }

    store.save({ ...initialState, status: "running", error: null });

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

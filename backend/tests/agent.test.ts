import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Agent } from "../src/core/agent.js";
import type { LlmClient, LlmRequest, LlmResponse } from "../src/core/llm/client.js";
import { createInitialState } from "../src/core/models/state.js";
import { serializeContextToText } from "../src/core/utils/contextSerializer.js";
import { StateStore } from "../src/server/database.js";

class ScriptedLlmClient implements LlmClient {
  private index = 0;

  constructor(private readonly responses: LlmResponse[]) {}

  async createResponse(_request: LlmRequest): Promise<LlmResponse> {
    const response = this.responses[this.index];
    this.index += 1;

    if (!response) {
      return { output: [] };
    }

    return response;
  }
}

describe("context serializer", () => {
  it("serializes the user request and completed calls", () => {
    const text = serializeContextToText([
      { role: "user", content: "Add two numbers" },
      {
        type: "function_call",
        name: "sum_numbers",
        arguments: JSON.stringify({ a: 2, b: 3 }),
        call_id: "call_1"
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output: JSON.stringify({ result: 5 })
      }
    ]);

    expect(text).toContain("Add two numbers");
    expect(text).toContain("sum_numbers(a=2, b=3)");
    expect(text).toContain("✓ COMPLETED:");
    expect(text).toContain("→ Result:");
    expect(text).toContain('{"result":5}');
  });
});

describe("Agent", () => {
  it("runs as a reducer over explicit state", async () => {
    const llmClient = new ScriptedLlmClient([
      {
        output: [
          {
            type: "function_call",
            name: "sum_numbers",
            arguments: JSON.stringify({ a: 15, b: 27 }),
            call_id: "call_sum"
          }
        ]
      },
      {
        output: [
          {
            type: "function_call",
            name: "final_answer",
            arguments: JSON.stringify({ answer: "42" }),
            call_id: "call_final"
          }
        ]
      }
    ]);

    const agent = new Agent({ llmClient, maxSteps: 5 });
    const initialState = createInitialState("state_1", "What is 15 + 27?");
    const finalState = await agent.run(initialState);

    expect(finalState.status).toBe("complete");
    expect(finalState.final_answer).toBe("42");
    expect(finalState.context).toHaveLength(4);
    expect(finalState.context[2]).toMatchObject({
      type: "function_call_output",
      call_id: "call_sum",
      output: JSON.stringify({ result: 42 })
    });
    expect(initialState.context).toHaveLength(1);
  });

  it("compacts tool errors into context", async () => {
    const llmClient = new ScriptedLlmClient([
      {
        output: [
          {
            type: "function_call",
            name: "divide_numbers",
            arguments: JSON.stringify({ a: 1, b: 0 }),
            call_id: "call_divide"
          }
        ]
      },
      {
        output: [
          {
            type: "function_call",
            name: "final_answer",
            arguments: JSON.stringify({ answer: "Cannot divide by zero." }),
            call_id: "call_final"
          }
        ]
      }
    ]);

    const agent = new Agent({ llmClient, maxSteps: 5 });
    const finalState = await agent.run(createInitialState("state_3", "What is 1 / 0?"));

    expect(finalState.status).toBe("complete");
    expect(finalState.context[2]).toMatchObject({
      type: "function_call_output",
      call_id: "call_divide",
      output: JSON.stringify({ result: "Error: Division by zero" })
    });
  });

  it("pauses when the model asks for human input", async () => {
    const llmClient = new ScriptedLlmClient([
      {
        output: [
          {
            type: "function_call",
            name: "ask_human",
            arguments: JSON.stringify({ question: "What value should I use?" }),
            call_id: "call_human"
          }
        ]
      }
    ]);

    const agent = new Agent({ llmClient, maxSteps: 5 });
    const finalState = await agent.run(createInitialState("state_2", "Ask me first"));

    expect(finalState.status).toBe("waiting_human_input");
    expect(finalState.context.at(-1)).toMatchObject({
      type: "function_call",
      name: "ask_human",
      call_id: "call_human"
    });
  });
});

describe("StateStore", () => {
  it("persists states in SQLite", () => {
    const directory = mkdtempSync(join(tmpdir(), "agent-state-store-"));
    const store = new StateStore(join(directory, "agent_states.db"));
    const initialState = createInitialState("state_sqlite", "What is 2 + 2?");

    store.save({
      ...initialState,
      steps: 2,
      context: [
        ...initialState.context,
        {
          type: "function_call",
          name: "sum_numbers",
          arguments: JSON.stringify({ a: 2, b: 2 }),
          call_id: "call_1"
        }
      ]
    });

    expect(store.get("state_sqlite")).toMatchObject({
      id: "state_sqlite",
      steps: 2,
      status: "running"
    });

    const updated = store.update("state_sqlite", (state) => ({
      ...state,
      status: "complete",
      final_answer: "4"
    }));

    expect(updated).toMatchObject({ status: "complete", final_answer: "4" });
    expect(store.get("state_sqlite")).toMatchObject({ status: "complete", final_answer: "4" });

    store.close();
  });
});

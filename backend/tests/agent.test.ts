import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { State } from "../src/core/models/state.js";
import { serializeContextToText } from "../src/core/utils/contextSerializer.js";
import { StateStore } from "../src/server/database.js";

// The Agent constructs its own OpenAI client, so tests stub the SDK module
// and script responses through this mock
const { createResponseMock } = vi.hoisted(() => ({ createResponseMock: vi.fn() }));

vi.mock("openai", () => ({
  default: class {
    responses = { create: createResponseMock };
  }
}));

const { Agent } = await import("../src/core/agent.js");

function functionCall(name: string, args: Record<string, unknown>, callId: string) {
  return {
    type: "function_call",
    name,
    arguments: JSON.stringify(args),
    call_id: callId
  };
}

function initialState(id: string, inputPrompt: string): State {
  return {
    id,
    steps: 0,
    status: "running",
    context: [{ role: "user", content: inputPrompt }],
    pending_tool_calls: [],
    error: null,
    final_answer: null
  };
}

beforeEach(() => {
  createResponseMock.mockReset();
  createResponseMock.mockResolvedValue({ output: [] });
});

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
    createResponseMock
      .mockResolvedValueOnce({ output: [functionCall("sum_numbers", { a: 15, b: 27 }, "call_sum")] })
      .mockResolvedValueOnce({ output: [functionCall("final_answer", { answer: "42" }, "call_final")] });

    const agent = new Agent({ maxSteps: 5 });
    const inputState = initialState("state_1", "What is 15 + 27?");
    const finalState = await agent.run(inputState);

    expect(finalState.status).toBe("complete");
    expect(finalState.final_answer).toBe("42");
    expect(finalState.context).toHaveLength(4);
    expect(finalState.context[2]).toMatchObject({
      type: "function_call_output",
      call_id: "call_sum",
      output: JSON.stringify({ result: 42 })
    });
    expect(inputState.context).toHaveLength(1);
  });

  it("compacts tool errors into context", async () => {
    createResponseMock
      .mockResolvedValueOnce({ output: [functionCall("divide_numbers", { a: 1, b: 0 }, "call_divide")] })
      .mockResolvedValueOnce({
        output: [functionCall("final_answer", { answer: "Cannot divide by zero." }, "call_final")]
      });

    const agent = new Agent({ maxSteps: 5 });
    const finalState = await agent.run(initialState("state_3", "What is 1 / 0?"));

    expect(finalState.status).toBe("complete");
    expect(finalState.context[2]).toMatchObject({
      type: "function_call_output",
      call_id: "call_divide",
      output: JSON.stringify({ result: "Error: Division by zero" })
    });
  });

  it("pauses when the model asks for human input", async () => {
    createResponseMock.mockResolvedValueOnce({
      output: [functionCall("ask_human", { question: "What value should I use?" }, "call_human")]
    });

    const agent = new Agent({ maxSteps: 5 });
    const finalState = await agent.run(initialState("state_2", "Ask me first"));

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
    const inputState = initialState("state_sqlite", "What is 2 + 2?");

    store.save({
      ...inputState,
      steps: 2,
      context: [
        ...inputState.context,
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

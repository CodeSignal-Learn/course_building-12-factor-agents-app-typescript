import { describe, expect, it } from "vitest";

import { Agent } from "../src/core/agent.js";
import type { LlmClient, LlmRequest, LlmResponse } from "../src/core/llm/client.js";
import { createInitialState } from "../src/core/models/state.js";
import { executeTool } from "../src/core/tools/executeTool.js";
import { serializeContextToText } from "../src/core/utils/contextSerializer.js";

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

describe("tools", () => {
  it("executes math tools and compacts errors", () => {
    expect(executeTool("sum_numbers", { a: 15, b: 27 })).toBe(JSON.stringify({ result: 42 }));
    expect(executeTool("divide_numbers", { a: 1, b: 0 })).toBe(
      JSON.stringify({ result: "Error: Division by zero" })
    );
  });
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
    expect(initialState.context).toHaveLength(1);
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

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type { ResponseOutputItem, Tool } from "openai/resources/responses/responses";

import type { PendingToolCall, State } from "./models/state.js";
import {
  divideNumbers,
  multiplyNumbers,
  power,
  squareRoot,
  subtractNumbers,
  sumNumbers
} from "./tools/functions/math.js";
import { serializeContextToText } from "./utils/contextSerializer.js";

// A callback lets the API layer persist state after every step (Factor 5)
type ProgressCallback = (state: State) => void | Promise<void>;

export interface AgentOptions {
  model?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  extraInstructions?: string;
  maxSteps?: number;
}

export class Agent {
  private readonly client = new OpenAI();
  private readonly model: string;
  private readonly reasoningEffort: "minimal" | "low" | "medium" | "high";
  private readonly maxSteps: number;
  private readonly systemPrompt: string;
  private readonly toolSchemas: Tool[];

  constructor(options: AgentOptions = {}) {
    this.model = options.model ?? "gpt-5";
    this.reasoningEffort = options.reasoningEffort ?? "low";
    this.maxSteps = options.maxSteps ?? 10;

    const baseDir = dirname(fileURLToPath(import.meta.url));
    this.systemPrompt =
      readFileSync(join(baseDir, "prompts", "base_system.md"), "utf8") + (options.extraInstructions ?? "");
    this.toolSchemas = [
      ...JSON.parse(readFileSync(join(baseDir, "tools", "schemas", "math.json"), "utf8")),
      JSON.parse(readFileSync(join(baseDir, "tools", "schemas", "final_answer.json"), "utf8")),
      // Include the ask_human schema so the model can escalate to a human (Factor 7)
      JSON.parse(readFileSync(join(baseDir, "tools", "schemas", "ask_human.json"), "utf8"))
    ] as Tool[];
  }

  // Reducer: State in, State out (Factor 12). The optional callback persists progress.
  async run(inputState: State, progressCallback?: ProgressCallback): Promise<State> {
    let state = structuredClone(inputState);
    state.status = "running";
    state.error = null;

    // Allow a resumed run (steps > 0) to make additional progress
    const maxStepsAllowed = state.steps > 0 ? state.steps + this.maxSteps : this.maxSteps;

    try {
      while (state.status === "running" && state.steps < maxStepsAllowed) {
        state = await this.nextStep(state);

        // Save after every step so polling clients always see durable progress
        if (progressCallback) {
          await progressCallback(state);
        }
      }

      if (state.status === "running" && state.steps >= maxStepsAllowed) {
        state.status = "max_steps_reached";
      }

      return state;
    } catch (error) {
      state.status = "failed";
      state.error = error instanceof Error ? error.message : String(error);
      state.pending_tool_calls = [];

      if (progressCallback) {
        await progressCallback(state);
      }

      return state;
    }
  }

  private async nextStep(state: State): Promise<State> {
    state.steps += 1;

    // Execute pending tool calls, recording each into unified context (Factor 5)
    for (const functionCall of [...state.pending_tool_calls]) {
      state.context.push({
        type: "function_call",
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.arguments),
        call_id: functionCall.call_id
      });

      if (functionCall.name === "final_answer") {
        state.pending_tool_calls = [];
        state.status = "complete";
        state.final_answer =
          typeof functionCall.arguments.answer === "string" ? functionCall.arguments.answer : null;
        return state;
      }

      if (functionCall.name === "ask_human") {
        // Human escalation: drop this call, pause the loop, and wait for input (Factor 7).
        // The ask_human function_call stays in context so the API can match the answer later.
        state.pending_tool_calls = state.pending_tool_calls.filter(
          (call) => call.call_id !== functionCall.call_id
        );
        state.status = "waiting_human_input";
        return state;
      }

      let output: string;
      switch (functionCall.name) {
        case "sum_numbers":
          try {
            output = JSON.stringify({
              result: sumNumbers(numberArg(functionCall.arguments, "a"), numberArg(functionCall.arguments, "b"))
            });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "multiply_numbers":
          try {
            output = JSON.stringify({
              result: multiplyNumbers(numberArg(functionCall.arguments, "a"), numberArg(functionCall.arguments, "b"))
            });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "subtract_numbers":
          try {
            output = JSON.stringify({
              result: subtractNumbers(numberArg(functionCall.arguments, "a"), numberArg(functionCall.arguments, "b"))
            });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "divide_numbers":
          try {
            output = JSON.stringify({
              result: divideNumbers(numberArg(functionCall.arguments, "a"), numberArg(functionCall.arguments, "b"))
            });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "power":
          try {
            output = JSON.stringify({
              result: power(numberArg(functionCall.arguments, "base"), numberArg(functionCall.arguments, "exponent"))
            });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "square_root":
          try {
            output = JSON.stringify({ result: squareRoot(numberArg(functionCall.arguments, "x")) });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        default:
          output = JSON.stringify({ result: `Error: Tool ${functionCall.name} not found` });
      }

      state.pending_tool_calls = state.pending_tool_calls.filter((call) => call.call_id !== functionCall.call_id);
      state.context.push({ type: "function_call_output", call_id: functionCall.call_id, output });
    }

    // Ask the model what tool call should happen next
    const response = await this.client.responses.create({
      model: this.model,
      instructions: this.systemPrompt,
      input: serializeContextToText(state.context),
      tools: this.toolSchemas,
      tool_choice: "required",
      reasoning: this.model === "gpt-5" ? { effort: this.reasoningEffort } : undefined
    });

    // Queue new tool calls inside the unified state for the next step
    state.pending_tool_calls.push(...response.output.filter(isFunctionCall).map(toPendingToolCall));
    return state;
  }
}

function toPendingToolCall(
  item: ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string }
): PendingToolCall {
  return {
    type: "function_call",
    name: item.name,
    arguments: JSON.parse(item.arguments) as Record<string, unknown>,
    call_id: item.call_id
  };
}

function numberArg(args: Record<string, unknown>, name: string): number {
  const value = args[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}

function compactToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ result: `Error: ${message}` });
}

function isFunctionCall(
  value: ResponseOutputItem
): value is ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string } {
  return value.type === "function_call";
}

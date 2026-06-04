import type { Tool } from "openai/resources/responses/responses";

import type { LlmClient, LlmFunctionCall } from "./llm/client.js";
import { OpenAiResponsesClient } from "./llm/client.js";
import type { PendingToolCall, State } from "./models/state.js";
import { cloneState } from "./models/state.js";
import {
  divideNumbers,
  multiplyNumbers,
  power,
  squareRoot,
  subtractNumbers,
  sumNumbers
} from "./tools/functions/math.js";
import { readAsset, readJsonAsset } from "./utils/assets.js";
import { serializeContextToText } from "./utils/contextSerializer.js";

type ProgressCallback = (state: State) => void | Promise<void>;

export interface AgentOptions {
  model?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  extraInstructions?: string;
  maxSteps?: number;
  llmClient?: LlmClient;
}

export class Agent {
  private readonly model: string;
  private readonly reasoningEffort: "minimal" | "low" | "medium" | "high";
  private readonly systemPrompt: string;
  private readonly maxSteps: number;
  private readonly toolSchemas: Tool[];
  private readonly llmClient: LlmClient;

  constructor(options: AgentOptions = {}) {
    this.model = options.model ?? "gpt-5";
    this.reasoningEffort = options.reasoningEffort ?? "low";
    this.systemPrompt =
      readAsset(import.meta.url, "./prompts/base_system.md") + (options.extraInstructions ?? "");
    this.maxSteps = options.maxSteps ?? 10;
    this.llmClient = options.llmClient ?? new OpenAiResponsesClient();

    const mathSchemas = readJsonAsset<Tool[]>(import.meta.url, "./tools/schemas/math.json");
    const finalAnswerSchema = readJsonAsset<Tool>(import.meta.url, "./tools/schemas/final_answer.json");
    const askHumanSchema = readJsonAsset<Tool>(import.meta.url, "./tools/schemas/ask_human.json");

    this.toolSchemas = [...mathSchemas, finalAnswerSchema, askHumanSchema];
  }

  async run(inputState: State, progressCallback?: ProgressCallback): Promise<State> {
    let state = cloneState(inputState);
    state.status = "running";
    state.error = null;

    const maxStepsAllowed = state.steps > 0 ? state.steps + this.maxSteps : this.maxSteps;

    try {
      while (state.status === "running" && state.steps < maxStepsAllowed) {
        state = await this.nextStep(state);

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

    for (const functionCall of [...state.pending_tool_calls]) {
      const callName = functionCall.name;
      const callArguments = functionCall.arguments;
      const callId = functionCall.call_id;

      state.context.push({
        type: "function_call",
        name: callName,
        arguments: JSON.stringify(callArguments),
        call_id: callId
      });

      if (callName === "ask_human") {
        state.pending_tool_calls = state.pending_tool_calls.filter((call) => call.call_id !== callId);
        state.status = "waiting_human_input";
        return state;
      }

      if (callName === "final_answer") {
        state.pending_tool_calls = [];
        state.status = "complete";
        state.final_answer = typeof callArguments.answer === "string" ? callArguments.answer : null;
        return state;
      }

      let output: string;
      switch (callName) {
        case "sum_numbers":
          try {
            const result = sumNumbers(numberArg(callArguments, "a"), numberArg(callArguments, "b"));
            output = JSON.stringify({ result });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "multiply_numbers":
          try {
            const result = multiplyNumbers(numberArg(callArguments, "a"), numberArg(callArguments, "b"));
            output = JSON.stringify({ result });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "subtract_numbers":
          try {
            const result = subtractNumbers(numberArg(callArguments, "a"), numberArg(callArguments, "b"));
            output = JSON.stringify({ result });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "divide_numbers":
          try {
            const result = divideNumbers(numberArg(callArguments, "a"), numberArg(callArguments, "b"));
            output = JSON.stringify({ result });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "power":
          try {
            const result = power(numberArg(callArguments, "base"), numberArg(callArguments, "exponent"));
            output = JSON.stringify({ result });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        case "square_root":
          try {
            const result = squareRoot(numberArg(callArguments, "x"));
            output = JSON.stringify({ result });
          } catch (error) {
            output = compactToolError(error);
          }
          break;

        default:
          output = JSON.stringify({ result: `Error: Tool ${callName} not found` });
      }

      state.pending_tool_calls = state.pending_tool_calls.filter((call) => call.call_id !== callId);
      state.context.push({
        type: "function_call_output",
        call_id: callId,
        output
      });
    }

    const response = await this.callLlm(state);
    state.pending_tool_calls.push(...response.map(toPendingToolCall));
    return state;
  }

  private async callLlm(state: State): Promise<LlmFunctionCall[]> {
    const serializedContent = serializeContextToText(state.context);
    const response = await this.llmClient.createResponse({
      model: this.model,
      reasoningEffort: this.reasoningEffort,
      instructions: this.systemPrompt,
      input: serializedContent,
      tools: this.toolSchemas
    });

    return response.output;
  }
}

function toPendingToolCall(functionCall: LlmFunctionCall): PendingToolCall {
  return {
    type: "function_call",
    name: functionCall.name,
    arguments: parseArguments(functionCall.arguments),
    call_id: functionCall.call_id
  };
}

function parseArguments(argumentsJson: string): Record<string, unknown> {
  const parsed = JSON.parse(argumentsJson) as unknown;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  throw new Error("Function call arguments must be a JSON object");
}

function compactToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ result: `Error: ${message}` });
}

function numberArg(args: Record<string, unknown>, name: string): number {
  const value = args[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}

import OpenAI from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseFunctionToolCall,
  ResponseOutputItem,
  Tool
} from "openai/resources/responses/responses";

export interface LlmRequest {
  model: string;
  reasoningEffort: "minimal" | "low" | "medium" | "high";
  instructions: string;
  input: string;
  tools: Tool[];
}

export interface LlmFunctionCall {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
}

export interface LlmResponse {
  output: LlmFunctionCall[];
}

export interface LlmClient {
  createResponse(request: LlmRequest): Promise<LlmResponse>;
}

export class OpenAiResponsesClient implements LlmClient {
  private readonly client: OpenAI | null;

  constructor(apiKey = process.env.OPENAI_API_KEY, baseURL = process.env.OPENAI_BASE_URL) {
    this.client = apiKey
      ? new OpenAI({
          apiKey,
          baseURL
        })
      : null;
  }

  async createResponse(request: LlmRequest): Promise<LlmResponse> {
    if (!this.client) {
      throw new Error("OPENAI_API_KEY is required");
    }

    const params: ResponseCreateParamsNonStreaming = {
      model: request.model,
      instructions: request.instructions,
      input: request.input,
      tools: request.tools,
      tool_choice: "required",
      reasoning: request.model === "gpt-5" ? { effort: request.reasoningEffort } : undefined
    };

    const response = await this.client.responses.create(params);
    return { output: response.output.filter(isFunctionToolCall).map(toLlmFunctionCall) };
  }
}

function isFunctionToolCall(item: ResponseOutputItem): item is ResponseFunctionToolCall {
  return item.type === "function_call";
}

function toLlmFunctionCall(functionCall: ResponseFunctionToolCall): LlmFunctionCall {
  return {
    type: "function_call",
    name: functionCall.name,
    arguments: functionCall.arguments,
    call_id: functionCall.call_id
  };
}

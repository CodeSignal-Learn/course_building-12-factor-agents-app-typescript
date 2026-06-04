export interface LlmRequest {
  model: string;
  reasoningEffort: "minimal" | "low" | "medium" | "high";
  instructions: string;
  input: string;
  tools: unknown[];
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
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(apiKey = process.env.OPENAI_API_KEY, baseUrl = process.env.OPENAI_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://api.openai.com/v1";
  }

  async createResponse(request: LlmRequest): Promise<LlmResponse> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: request.model,
        instructions: request.instructions,
        input: request.input,
        tools: request.tools,
        tool_choice: "required",
        reasoning: request.model === "gpt-5" ? { effort: request.reasoningEffort } : undefined
      })
    });

    const body = (await response.json()) as unknown;

    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status}): ${formatUnknown(body)}`);
    }

    return { output: extractFunctionCalls(body) };
  }
}

function extractFunctionCalls(body: unknown): LlmFunctionCall[] {
  if (typeof body !== "object" || body === null || !("output" in body) || !Array.isArray(body.output)) {
    return [];
  }

  return body.output.filter(isLlmFunctionCall);
}

function isLlmFunctionCall(value: unknown): value is LlmFunctionCall {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "function_call" &&
    "name" in value &&
    typeof value.name === "string" &&
    "arguments" in value &&
    typeof value.arguments === "string" &&
    "call_id" in value &&
    typeof value.call_id === "string"
  );
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

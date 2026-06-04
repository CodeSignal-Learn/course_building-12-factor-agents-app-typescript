import { askHumanCli } from "../core/tools/functions/humanInteraction.js";
import type { FunctionCallContextItem, State } from "../core/models/state.js";

const baseUrl = process.env.AGENT_BASE_URL ?? "http://localhost:8000";

class Client {
  constructor(private readonly apiBaseUrl: string) {}

  async launch(inputPrompt: string): Promise<State> {
    return this.post<State>("/agent/launch", { input_prompt: inputPrompt });
  }

  async resume(id: string): Promise<State> {
    return this.post<State>("/agent/resume", { id });
  }

  async getState(id: string): Promise<State> {
    const response = await fetch(`${this.apiBaseUrl}/agent/state/${encodeURIComponent(id)}`);
    return parseResponse<State>(response);
  }

  async provideInput(id: string, answer: string): Promise<State> {
    return this.post<State>("/agent/provide_input", { id, answer });
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return parseResponse<T>(response);
  }
}

function isTerminalStatus(status: State["status"]): boolean {
  return status === "complete" || status === "failed" || status === "max_steps_reached";
}

function extractAskHumanCall(state: State): FunctionCallContextItem | null {
  for (const item of [...state.context].reverse()) {
    if ("type" in item && item.type === "function_call" && item.name === "ask_human") {
      return item;
    }
  }

  return null;
}

async function handleHumanInput(client: Client, stateId: string, currentState: State): Promise<State> {
  const askHumanCall = extractAskHumanCall(currentState);
  if (!askHumanCall) {
    console.log("Agent is waiting for input but ask_human call not found");
    return currentState;
  }

  try {
    const output = await askHumanCli(askHumanCall);
    const parsed = JSON.parse(output.output) as { answer?: unknown };
    if (typeof parsed.answer !== "string") {
      console.log("Human input did not produce a string answer");
      return currentState;
    }

    return await client.provideInput(stateId, parsed.answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Error providing input: ${message}`);
    return currentState;
  }
}

async function pollUntilComplete(client: Client, stateId: string): Promise<State> {
  while (true) {
    let state = await client.getState(stateId);
    console.log(`Status: ${state.status}, steps: ${state.steps}`);

    if (state.status === "waiting_human_input") {
      state = await handleHumanInput(client, stateId, state);
      await delay(5000);
      continue;
    }

    if (isTerminalStatus(state.status)) {
      if (state.status === "failed") {
        console.log(`Agent failed: ${state.error ?? "Unknown error"}`);
      }
      return state;
    }

    await delay(5000);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body ? String(body.detail) : response.statusText;
    throw new Error(detail);
  }

  return body as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  const client = new Client(baseUrl);
  const prompt = process.argv.slice(2).join(" ") || "Solve the roots of this equation: x^2 - 5x + 6 = ";
  const launched = await client.launch(prompt);

  console.log("Launched agent:");
  console.log(JSON.stringify(launched, null, 2));
  const finalState = await pollUntilComplete(client, launched.id);

  console.log("\nFinal state:");
  console.log(JSON.stringify(finalState, null, 2));
}

await main();

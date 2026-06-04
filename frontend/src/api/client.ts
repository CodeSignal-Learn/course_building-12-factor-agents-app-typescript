import type { AgentState } from "../types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body ? String(body.detail) : response.statusText;
    throw new Error(detail);
  }

  return body as T;
}

export const agentApi = {
  launch(inputPrompt: string): Promise<AgentState> {
    return request<AgentState>("/agent/launch", {
      method: "POST",
      body: JSON.stringify({ input_prompt: inputPrompt })
    });
  },

  getState(stateId: string): Promise<AgentState> {
    return request<AgentState>(`/agent/state/${encodeURIComponent(stateId)}`);
  },

  pause(stateId: string): Promise<AgentState> {
    return request<AgentState>("/agent/pause", {
      method: "POST",
      body: JSON.stringify({ id: stateId })
    });
  },

  resume(stateId: string): Promise<AgentState> {
    return request<AgentState>("/agent/resume", {
      method: "POST",
      body: JSON.stringify({ id: stateId })
    });
  },

  provideInput(stateId: string, answer: string): Promise<AgentState> {
    return request<AgentState>("/agent/provide_input", {
      method: "POST",
      body: JSON.stringify({ id: stateId, answer })
    });
  }
};

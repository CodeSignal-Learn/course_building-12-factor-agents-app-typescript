export type AgentStatus =
  | "running"
  | "paused"
  | "complete"
  | "failed"
  | "waiting_human_input"
  | "max_steps_reached";

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
}

export interface FunctionCallContextItem {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
}

export interface FunctionCallOutputContextItem {
  type: "function_call_output";
  call_id: string;
  output: string;
}

export type ContextItem =
  | UserMessage
  | AssistantMessage
  | FunctionCallContextItem
  | FunctionCallOutputContextItem;

export interface PendingToolCall {
  type: "function_call";
  name: string;
  arguments: Record<string, unknown>;
  call_id: string;
}

export interface State {
  id: string;
  steps: number;
  status: AgentStatus;
  context: ContextItem[];
  pending_tool_calls: PendingToolCall[];
  error: string | null;
  final_answer: string | null;
}

export function createInitialState(id: string, inputPrompt: string): State {
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

export function cloneState(state: State): State {
  return structuredClone(state);
}

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
  arguments: string | Record<string, unknown>;
  call_id: string;
}

export interface FunctionCallOutputContextItem {
  type: "function_call_output";
  call_id: string;
  output: string | Record<string, unknown>;
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

export interface AgentState {
  id: string;
  steps: number;
  status: AgentStatus;
  context: ContextItem[];
  pending_tool_calls: PendingToolCall[];
  error: string | null;
  final_answer: string | null;
}

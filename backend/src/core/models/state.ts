// The statuses are declared as a runtime array so that data read back from the
// database can be validated at runtime. TypeScript types are erased at runtime,
// so we derive the AgentStatus type from this single source of truth.
export const AGENT_STATUSES = [
  "running",
  "paused",
  "waiting_human_input",
  "complete",
  "failed",
  "max_steps_reached"
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type ContextItem =
  | { role: "user"; content: string }
  | { type: "function_call"; name: string; arguments: string; call_id: string }
  | { type: "function_call_output"; call_id: string; output: string };

// Pending tool calls are stored separately until the reducer executes them
export interface PendingToolCall {
  type: "function_call";
  name: string;
  arguments: Record<string, unknown>;
  call_id: string;
}

// Unified state carries execution state and business state together
export interface State {
  id: string;
  steps: number;
  status: AgentStatus;
  context: ContextItem[];
  pending_tool_calls: PendingToolCall[];
  error: string | null;
  final_answer: string | null;
}

import type { AgentStatus as AgentStatusValue } from "../types";

interface AgentStatusProps {
  status: AgentStatusValue;
  steps: number;
  finalAnswer: string | null;
  error: string | null;
}

const labels: Record<AgentStatusValue, string> = {
  running: "Running",
  paused: "Paused",
  complete: "Complete",
  failed: "Failed",
  waiting_human_input: "Waiting for input",
  max_steps_reached: "Max steps reached"
};

function AgentStatus({ status, steps, finalAnswer, error }: AgentStatusProps): JSX.Element {
  return (
    <div className="agent-status">
      <div className={`status-pill status-${status.replace(/_/g, "-")}`}>{labels[status]}</div>
      <div className="step-count">Step {steps}</div>

      {finalAnswer && (
        <div className="result-panel">
          <h2>Final Answer</h2>
          <p>{finalAnswer}</p>
        </div>
      )}

      {error && (
        <div className="error-panel">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

export default AgentStatus;

import type { AgentState, ContextItem } from "../types";

interface AgentHistoryProps {
  agents: AgentState[];
  selectedId: string | null;
  onSelectAgent: (agentId: string) => void | Promise<void>;
}

const statusClassName: Record<string, string> = {
  running: "status-running",
  paused: "status-paused",
  complete: "status-complete",
  failed: "status-failed",
  waiting_human_input: "status-waiting",
  max_steps_reached: "status-max"
};

function AgentHistory({ agents, selectedId, onSelectAgent }: AgentHistoryProps): JSX.Element {
  return (
    <div className="agent-history">
      <div className="sidebar-header">
        <h2>History</h2>
        <span>{agents.length}</span>
      </div>

      {agents.length === 0 ? (
        <p className="empty-history">No runs yet.</p>
      ) : (
        <div className="history-list">
          {agents.map((agent) => (
            <button
              type="button"
              key={agent.id}
              className={`history-item ${selectedId === agent.id ? "selected" : ""}`}
              onClick={() => {
                void onSelectAgent(agent.id);
              }}
            >
              <span className={`status-dot ${statusClassName[agent.status] ?? ""}`} />
              <span className="history-body">
                <strong>{getInitialPrompt(agent.context)}</strong>
                <span>
                  {agent.id.slice(0, 8)}... · {agent.status} · {agent.steps} steps
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getInitialPrompt(context: ContextItem[]): string {
  const userMessage = context.find((item) => "role" in item && item.role === "user");
  return userMessage?.content ?? "No prompt available";
}

export default AgentHistory;

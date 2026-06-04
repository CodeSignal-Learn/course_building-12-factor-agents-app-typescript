import { Pause, Play, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { agentApi } from "./api/client";
import AgentHistory from "./components/AgentHistory";
import AgentStatus from "./components/AgentStatus";
import ExecutionView from "./components/ExecutionView";
import HumanInputDialog from "./components/HumanInputDialog";
import TaskForm from "./components/TaskForm";
import type { AgentState, ContextItem } from "./types";
import "./App.css";

const terminalStatuses = new Set(["complete", "failed", "max_steps_reached"]);
const nonResumableStatuses = new Set(["complete", "failed"]);
const pollIntervalMs = 500;

interface HumanInputState {
  agentId: string;
  question: string;
}

function App(): JSX.Element {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [humanInputQuestion, setHumanInputQuestion] = useState<HumanInputState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const selectedAgentIdRef = useRef<string | null>(null);

  const stopPolling = (): void => {
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const updateAgentState = (state: AgentState): void => {
    setAgents((previous) => {
      const index = previous.findIndex((agent) => agent.id === state.id);
      if (index === -1) {
        return [state, ...previous];
      }

      const updated = [...previous];
      updated[index] = state;
      return updated;
    });

    if (selectedAgentIdRef.current === state.id) {
      setSelectedAgent(state);
    }
  };

  const startPolling = (agentId: string): void => {
    stopPolling();
    let isRequestInFlight = false;

    pollingIntervalRef.current = window.setInterval(() => {
      if (isRequestInFlight) {
        return;
      }

      isRequestInFlight = true;
      void agentApi
        .getState(agentId)
        .then((state) => {
          updateAgentState(state);

          if (state.status === "waiting_human_input") {
            const question = extractAskHumanQuestion(state.context);
            setHumanInputQuestion({ agentId, question });
            stopPolling();
          }

          if (terminalStatuses.has(state.status)) {
            stopPolling();
          }
        })
        .catch((error: unknown) => {
          setNotice(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          isRequestInFlight = false;
        });
    }, pollIntervalMs);
  };

  const handleLaunch = async (prompt: string): Promise<void> => {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const state = await agentApi.launch(prompt);
      setAgents((previous) => [state, ...previous]);
      setSelectedAgent(state);
      selectedAgentIdRef.current = state.id;
      startPolling(state.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectAgent = async (agentId: string): Promise<void> => {
    setNotice(null);

    try {
      const state = await agentApi.getState(agentId);
      setSelectedAgent(state);
      selectedAgentIdRef.current = agentId;

      if (!terminalStatuses.has(state.status)) {
        startPolling(agentId);
      } else {
        stopPolling();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const handlePause = async (): Promise<void> => {
    if (!selectedAgent) {
      return;
    }

    try {
      const state = await agentApi.pause(selectedAgent.id);
      updateAgentState(state);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const handleResume = async (): Promise<void> => {
    if (!selectedAgent) {
      return;
    }

    try {
      const state = await agentApi.resume(selectedAgent.id);
      updateAgentState(state);
      selectedAgentIdRef.current = state.id;
      startPolling(state.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const handleProvideInput = async (answer: string): Promise<void> => {
    if (!humanInputQuestion) {
      return;
    }

    try {
      const state = await agentApi.provideInput(humanInputQuestion.agentId, answer);
      updateAgentState(state);
      setHumanInputQuestion(null);
      selectedAgentIdRef.current = state.id;
      startPolling(state.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => stopPolling, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <AgentHistory agents={agents} onSelectAgent={handleSelectAgent} selectedId={selectedAgent?.id ?? null} />
      </aside>

      <main className="main-content">
        <section className="top-bar" aria-label="Agent launch">
          <TaskForm onSubmit={handleLaunch} isSubmitting={isSubmitting} />
        </section>

        {notice && (
          <div className="notice" role="alert">
            {notice}
          </div>
        )}

        {selectedAgent ? (
          <section className="agent-workspace" aria-label="Agent details">
            <div className="workspace-header">
              <div>
                <h1>Agent Run</h1>
                <p>{selectedAgent.id}</p>
              </div>

              <div className="workspace-actions">
                {selectedAgent.status === "running" && (
                  <button type="button" className="icon-button warning" onClick={handlePause} aria-label="Pause agent">
                    <Pause size={18} />
                    <span>Pause</span>
                  </button>
                )}

                {selectedAgent.status !== "running" &&
                  selectedAgent.status !== "waiting_human_input" &&
                  !nonResumableStatuses.has(selectedAgent.status) && (
                    <button type="button" className="icon-button success" onClick={handleResume} aria-label="Resume agent">
                      <Play size={18} />
                      <span>Resume</span>
                    </button>
                  )}
              </div>
            </div>

            <AgentStatus
              status={selectedAgent.status}
              steps={selectedAgent.steps}
              finalAnswer={selectedAgent.final_answer}
              error={selectedAgent.error}
            />
            <ExecutionView context={selectedAgent.context} pendingToolCalls={selectedAgent.pending_tool_calls} />
          </section>
        ) : (
          <section className="empty-workspace" aria-label="No selected agent">
            <Send size={32} />
            <p>Launch an agent to inspect its state, tool calls, and outputs.</p>
          </section>
        )}
      </main>

      <HumanInputDialog
        isOpen={humanInputQuestion !== null}
        question={humanInputQuestion?.question ?? ""}
        onSubmit={handleProvideInput}
        onClose={() => setHumanInputQuestion(null)}
      />
    </div>
  );
}

function extractAskHumanQuestion(context: ContextItem[]): string {
  for (const item of [...context].reverse()) {
    if ("type" in item && item.type === "function_call" && item.name === "ask_human") {
      const args = typeof item.arguments === "string" ? parseJson(item.arguments) : item.arguments;
      if (
        typeof args === "object" &&
        args !== null &&
        "question" in args &&
        typeof args.question === "string"
      ) {
        return args.question;
      }
    }
  }

  return "Please provide input";
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

export default App;

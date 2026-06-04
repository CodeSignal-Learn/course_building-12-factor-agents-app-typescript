import type { ContextItem, PendingToolCall } from "../types";

interface ExecutionViewProps {
  context: ContextItem[];
  pendingToolCalls: PendingToolCall[];
}

function ExecutionView({ context, pendingToolCalls }: ExecutionViewProps): JSX.Element {
  return (
    <div className="execution-view">
      <div className="section-heading">
        <h2>Execution Context</h2>
        <span>{context.length} entries</span>
      </div>

      <div className="context-list">
        {context.map((item, index) => (
          <ContextRow item={item} key={`${index}-${getItemKey(item)}`} />
        ))}
      </div>

      {pendingToolCalls.length > 0 && (
        <div className="pending-calls">
          <h3>Pending Tool Calls</h3>
          {pendingToolCalls.map((call) => (
            <div className="pending-call" key={call.call_id}>
              <strong>{call.name}</strong>
              <code>{formatRecord(call.arguments)}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContextRow({ item }: { item: ContextItem }): JSX.Element {
  if ("role" in item) {
    return (
      <div className={`context-row message ${item.role}`}>
        <span>{item.role === "user" ? "User" : "Assistant"}</span>
        <p>{item.content}</p>
      </div>
    );
  }

  if (item.type === "function_call") {
    const args = typeof item.arguments === "string" ? parseJsonObject(item.arguments) : item.arguments;
    return (
      <div className="context-row function-call">
        <span>Tool Call</span>
        <p>
          <strong>{item.name}</strong>
        </p>
        <code>{formatRecord(args)}</code>
        <small>{item.call_id}</small>
      </div>
    );
  }

  const output = typeof item.output === "string" ? parseJsonObject(item.output) : item.output;
  return (
    <div className="context-row function-output">
      <span>Tool Output</span>
      <code>{formatOutput(output)}</code>
      <small>{item.call_id}</small>
    </div>
  );
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return { raw: value };
  }

  return { raw: value };
}

function formatRecord(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${formatScalar(entry)}`)
    .join(", ");
}

function formatOutput(value: Record<string, unknown>): string {
  if ("result" in value) {
    return String(value.result);
  }

  if ("answer" in value) {
    return String(value.answer);
  }

  return JSON.stringify(value);
}

function formatScalar(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

function getItemKey(item: ContextItem): string {
  if ("role" in item) {
    return item.content;
  }

  return item.call_id;
}

export default ExecutionView;

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AGENT_STATUSES } from "../core/models/state.js";
import type { AgentStatus, ContextItem, PendingToolCall, State } from "../core/models/state.js";

interface StateRow {
  id: string;
  steps: number;
  status: string;
  context: string;
  pending_tool_calls: string;
  error: string | null;
  final_answer: string | null;
}

export class StateStore {
  private readonly db: Database.Database;

  constructor(dbPath = defaultDatabasePath()) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.createTables();
  }

  get(id: string): State | null {
    const row = this.db.prepare("SELECT * FROM states WHERE id = ?").get(id);
    return isStateRow(row) ? rowToState(row) : null;
  }

  save(state: State): State {
    this.db
      .prepare(
        `INSERT INTO states (
          id,
          steps,
          status,
          context,
          pending_tool_calls,
          error,
          final_answer
        ) VALUES (
          @id,
          @steps,
          @status,
          @context,
          @pending_tool_calls,
          @error,
          @final_answer
        ) ON CONFLICT(id) DO UPDATE SET
          steps = excluded.steps,
          status = excluded.status,
          context = excluded.context,
          pending_tool_calls = excluded.pending_tool_calls,
          error = excluded.error,
          final_answer = excluded.final_answer`
      )
      .run(stateToRow(state));

    return state;
  }

  update(id: string, updater: (state: State) => State): State | null {
    const current = this.get(id);
    if (!current) {
      return null;
    }

    const updated = updater(structuredClone(current));
    this.save(updated);
    return updated;
  }

  close(): void {
    this.db.close();
  }

  private createTables(): void {
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS states (
          id TEXT PRIMARY KEY,
          steps INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'running',
          context TEXT NOT NULL DEFAULT '[]',
          pending_tool_calls TEXT NOT NULL DEFAULT '[]',
          error TEXT,
          final_answer TEXT
        )`
      )
      .run();
  }
}

function stateToRow(state: State): StateRow {
  return {
    id: state.id,
    steps: state.steps,
    status: state.status,
    context: JSON.stringify(state.context),
    pending_tool_calls: JSON.stringify(state.pending_tool_calls),
    error: state.error,
    final_answer: state.final_answer
  };
}

function rowToState(row: StateRow): State {
  return {
    id: row.id,
    steps: row.steps,
    status: parseStatus(row.status),
    context: parseJsonArray<ContextItem>(row.context),
    pending_tool_calls: parseJsonArray<PendingToolCall>(row.pending_tool_calls),
    error: row.error,
    final_answer: row.final_answer
  };
}

// Validate against the shared status list so the table stays stable as new
// statuses are introduced in later units (just extend AGENT_STATUSES)
function parseStatus(value: string): AgentStatus {
  if ((AGENT_STATUSES as readonly string[]).includes(value)) {
    return value as AgentStatus;
  }

  throw new Error(`Unknown state status: ${value}`);
}

function parseJsonArray<T>(raw: string): T[] {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as T[];
  }

  return [];
}

function isStateRow(value: unknown): value is StateRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "steps" in value &&
    typeof value.steps === "number" &&
    "status" in value &&
    typeof value.status === "string" &&
    "context" in value &&
    typeof value.context === "string" &&
    "pending_tool_calls" in value &&
    typeof value.pending_tool_calls === "string" &&
    "error" in value &&
    (typeof value.error === "string" || value.error === null) &&
    "final_answer" in value &&
    (typeof value.final_answer === "string" || value.final_answer === null)
  );
}

function defaultDatabasePath(): string {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  return join(currentDirectory, "../../data/agent_states.db");
}

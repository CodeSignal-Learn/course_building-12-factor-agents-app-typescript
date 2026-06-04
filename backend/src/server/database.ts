import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { State } from "../core/models/state.js";

interface StateStoreFile {
  states: Record<string, State>;
}

export class StateStore {
  private readonly filePath: string;

  constructor(filePath = defaultStorePath()) {
    this.filePath = filePath;
    mkdirSync(dirname(this.filePath), { recursive: true });
    this.ensureFile();
  }

  get(id: string): State | null {
    return this.readAll().states[id] ?? null;
  }

  save(state: State): State {
    const all = this.readAll();
    all.states[state.id] = state;
    this.writeAll(all);
    return state;
  }

  update(id: string, updater: (state: State) => State): State | null {
    const all = this.readAll();
    const current = all.states[id];
    if (!current) {
      return null;
    }

    const updated = updater(structuredClone(current));
    all.states[id] = updated;
    this.writeAll(all);
    return updated;
  }

  private ensureFile(): void {
    try {
      readFileSync(this.filePath, "utf8");
    } catch {
      this.writeAll({ states: {} });
    }
  }

  private readAll(): StateStoreFile {
    const raw = readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "states" in parsed &&
      typeof parsed.states === "object" &&
      parsed.states !== null &&
      !Array.isArray(parsed.states)
    ) {
      return parsed as StateStoreFile;
    }

    return { states: {} };
  }

  private writeAll(value: StateStoreFile): void {
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(value, null, 2));
    renameSync(tempPath, this.filePath);
  }
}

function defaultStorePath(): string {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  return join(currentDirectory, "../../data/agent_states.json");
}

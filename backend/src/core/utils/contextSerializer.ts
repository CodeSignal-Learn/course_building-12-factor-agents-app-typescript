import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ContextItem } from "../models/state.js";

const templatePath = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts", "context_format.md");
const template = readFileSync(templatePath, "utf8");

export function serializeContextToText(context: ContextItem[]): string {
  // Extract the original user request from structured context
  const userMessage =
    context.find((item): item is { role: "user"; content: string } => "role" in item && item.role === "user")
      ?.content ?? "";
  // Format completed tool calls and outputs into a readable execution history
  const executionHistory = buildCompletedActionLines(context);

  // Fill the owned markdown template with exactly the context we want the model to see
  return template
    .replace("{user_message}", userMessage)
    .replace("{execution_history}", executionHistory.length > 0 ? executionHistory.join("\n") : "(No actions completed yet)");
}

function buildCompletedActionLines(context: ContextItem[]): string[] {
  const callsById = new Map<string, string>();

  for (const item of context) {
    if ("type" in item && item.type === "function_call") {
      callsById.set(item.call_id, `${item.name}(${formatArgs(item.arguments)})`);
    }
  }

  const lines: string[] = [];
  for (const item of context) {
    if ("type" in item && item.type === "function_call_output") {
      const callText = callsById.get(item.call_id) ?? `unknown_call(${item.call_id})`;
      lines.push(`✓ COMPLETED: ${callText} → Result: ${item.output}`);
    }
  }

  return lines;
}

function formatArgs(argumentsJson: string): string {
  try {
    const parsed = JSON.parse(argumentsJson) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => `${key}=${formatValue(value)}`)
      .join(", ");
  } catch {
    return argumentsJson;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

import type { ContextItem, FunctionCallContextItem } from "../models/state.js";
import { readAsset } from "./assets.js";

const contextTemplate = readAsset(import.meta.url, "../prompts/context_format.md");

export function serializeContextToText(context: ContextItem[]): string {
  if (context.length === 0) {
    return "";
  }

  const userMessage = context.find((item) => "role" in item && item.role === "user")?.content ?? "";
  const callMap = new Map<string, string>();

  for (const item of context) {
    if ("type" in item && item.type === "function_call") {
      callMap.set(item.call_id, formatFunctionCall(item));
    }
  }

  const historyLines: string[] = [];

  for (const item of context) {
    if ("type" in item && item.type === "function_call_output") {
      const callText = callMap.get(item.call_id) ?? `unknown_call(${item.call_id})`;
      historyLines.push(`COMPLETED: ${callText} -> Result: ${item.output}`);
    }
  }

  return contextTemplate
    .replace("{user_message}", userMessage)
    .replace(
      "{execution_history}",
      historyLines.length > 0 ? historyLines.join("\n") : "(No actions completed yet)"
    );
}

function formatFunctionCall(item: FunctionCallContextItem): string {
  const parsed = parseJson(item.arguments);
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const pairs = Object.entries(parsed)
      .map(([key, value]) => `${key}=${formatValue(value)}`)
      .join(", ");
    return `${item.name}(${pairs})`;
  }

  return `${item.name}(${item.arguments})`;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}

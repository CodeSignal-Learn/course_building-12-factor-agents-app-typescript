import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { ContextItem } from "../../models/state.js";

type FunctionCallContextItem = Extract<ContextItem, { type: "function_call" }>;
type FunctionCallOutputContextItem = Extract<ContextItem, { type: "function_call_output" }>;

function parseQuestion(functionCall: FunctionCallContextItem): string {
  const parsed = JSON.parse(functionCall.arguments) as unknown;
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "question" in parsed &&
    typeof parsed.question === "string"
  ) {
    return parsed.question;
  }

  return "Please provide input";
}

export async function askHumanCli(
  functionCall: FunctionCallContextItem
): Promise<FunctionCallOutputContextItem> {
  const question = parseQuestion(functionCall);
  const readline = createInterface({ input, output });

  try {
    const answer = await readline.question(`\nAgent is asking: ${question}\n> `);
    return {
      type: "function_call_output",
      call_id: functionCall.call_id,
      output: JSON.stringify({ answer })
    };
  } finally {
    readline.close();
  }
}

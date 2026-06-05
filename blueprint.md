# Course 1: Understanding the 12-Factor Agents Methodology

## Overview
Discover why reliable AI agents require more than delegating work to off-the-shelf frameworks. This foundational course introduces the 12-Factor Agents methodology, distilling lessons that separate flashy demos from production systems. Learn how well-engineered software augmented with targeted LLM integration, and twelve clear principles, yields maintainable, scalable, and trustworthy agentic apps.

## Outline
### Unit 1 - Why Principles Matter for Reliable Agent Systems
#### Goal
Understand the fundamental challenges of building production-ready AI agents and why principled approaches succeed where ad-hoc implementations fail. Students learn about the "70-80% reliability wall", the limits of framework-first designs, and how disciplined software engineering improves LLM-powered systems.

The twelve factors are:

- Factor 1: Natural Language to Tool Calls
- Factor 2: Own your prompts
- Factor 3: Own your context window
- Factor 4: Tools are just structured outputs
- Factor 5: Unify execution state and business state
- Factor 6: Launch/Pause/Resume with simple APIs
- Factor 7: Contact humans with tool calls
- Factor 8: Own your control flow
- Factor 9: Compact Errors into Context Window
- Factor 10: Small, Focused Agents
- Factor 11: Trigger from anywhere, meet users where they are
- Factor 12: Make your agent a stateless reducer

### Unit 2 - Factors 1-4: Structure Prompts, Tools, and Context
#### Goal
Explore the foundational principles for controlling how LLMs interact with your system. Students learn Factor 1 by translating user requests into machine-executable commands, Factor 2 by treating prompts as versioned artifacts, Factor 3 by explicitly managing context, and Factor 4 by treating function calls as validated JSON objects.

### Unit 3 - Factors 5-8: Manage State and Control Flow
#### Goal
Learn the conceptual framework for designing agent systems where state is transparent and workflows remain under application control. Students learn to unify execution and business state, design launch/pause/resume lifecycle checkpoints, make human escalation a first-class action, and maintain explicit control loops.

### Unit 4 - Factors 9-12: Keep Agents Small and Stateless
#### Goal
Understand the architectural principles that make agents maintainable and scalable. Students learn to feed execution failures back to the model, keep agents focused, trigger workflows from any interface, and model agents as stateless reducers.

---

# Course 2: Foundations of Agentic Tool Use in TypeScript

## Overview
Master the practical building blocks of agentic systems in TypeScript. Covering Factors 1, 3, 4, 8, and 9, this course teaches structured model outputs with the official OpenAI TypeScript SDK, typed tool schemas, explicit context management, and controlled loops that execute tools and compact errors back into context.

## Outline
### Unit 1 - Prompting LLMs for Structured Outputs
#### Goal
Teach how to prompt the Responses API to return structured JSON that can be parsed and processed. This grounds Factor 1 by having the model translate natural language into schema-shaped output.

#### Files

`main.ts`
```typescript
import OpenAI from "openai";

// Create the official OpenAI SDK client.
// It reads OPENAI_API_KEY from the environment by default.
const client = new OpenAI();

// Define the system prompt that instructs the model on its behavior.
const systemPrompt = `
You are a helpful assistant that only answers with this JSON schema:
{
  "answer": "the answer to the question"
}
`;

// Make a request to the Responses API through the official SDK.
// The input is a list of messages, starting with the user's question.
const response = await client.responses.create({
  model: "gpt-5",
  instructions: systemPrompt,
  input: [{ role: "user", content: "What is 15 + 27?" }],
  reasoning: { effort: "low" }
});

try {
  // Parse the output text to extract the JSON answer.
  const result = JSON.parse(response.output_text) as { answer?: string };
  // Extract and print the answer field.
  console.log(`Answer: ${result.answer}`);
} catch {
  // Handle cases where the model did not return valid JSON.
  console.log("Failed to parse JSON from response");
}
```

### Unit 2 - Defining a Tool Schema and Requiring Tool Use
#### Goal
Write a tool schema, provide it to the model, and handle the tool-call output. Students reinforce Factor 4 by parsing a structured function call and requiring tool use with `tool_choice: "required"`.

#### Files

`main.ts`
```typescript
import OpenAI from "openai";
import type { ResponseOutputItem, Tool } from "openai/resources/responses/responses";

// Create the official OpenAI SDK client.
const client = new OpenAI();

// Define a single tool schema for final_answer.
// The model must call this function instead of returning ordinary text.
const toolSchemas: Tool[] = [
  {
    type: "function",
    name: "final_answer",
    description: "Provide the final answer and stop.",
    parameters: {
      type: "object",
      properties: {
        answer: { type: "string", description: "The final answer for the user." }
      },
      required: ["answer"],
      additionalProperties: false
    }
  }
];

// Require the model to choose a tool call.
const response = await client.responses.create({
  model: "gpt-5",
  instructions: "You are a helpful assistant.",
  input: [{ role: "user", content: "What is 15 + 27?" }],
  tools: toolSchemas,
  tool_choice: "required",
  reasoning: { effort: "low" }
});

// The model returns a function_call item with JSON arguments.
const call = response.output.find(isFunctionCall);
if (call?.name === "final_answer") {
  // Parse the validated JSON arguments from the tool call.
  const args = JSON.parse(call.arguments) as { answer: string };
  console.log(`Answer: ${args.answer}`);
}

// Narrow SDK response items into the function-call shape we expect.
function isFunctionCall(
  value: ResponseOutputItem
): value is ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string } {
  return value.type === "function_call";
}
```

### Unit 3 - Executing Tool Calls and Managing Context
#### Goal
Demonstrate executing function calls from model responses and feeding results back into explicit context. This introduces Factor 3 by showing that the application owns what the model sees next.

#### Files

`main.ts`
```typescript
import OpenAI from "openai";
import type { ResponseOutputItem, Tool } from "openai/resources/responses/responses";

// Define the functions we want to make available to the model.
function add(a: number, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

// Define the structured context items this lesson needs.
// Context will grow as we add function calls and their results.
type ContextItem =
  | { role: "user"; content: string }
  | { type: "function_call"; name: string; arguments: string; call_id: string }
  | { type: "function_call_output"; call_id: string; output: string };

// Define tool schemas for the model, including final_answer.
const toolSchemas: Tool[] = [
  {
    type: "function",
    name: "final_answer",
    description: "Provide the final answer and stop.",
    parameters: {
      type: "object",
      properties: {
        answer: { type: "string", description: "The final answer for the user." }
      },
      required: ["answer"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "add",
    description: "Add two numbers together",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number", description: "The first number" },
        b: { type: "number", description: "The second number" }
      },
      required: ["a", "b"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "multiply",
    description: "Multiply two numbers together",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number", description: "The first number" },
        b: { type: "number", description: "The second number" }
      },
      required: ["a", "b"],
      additionalProperties: false
    }
  }
];

const client = new OpenAI();

const systemPrompt = `
You are a helpful assistant that can perform calculations.
When asked to do math, you must use the provided tools.
When your work is done, call the final_answer tool.
`;

// Initialize context with the user's message.
const context: ContextItem[] = [
  { role: "user", content: "Compute 15 + 27 and 8 * 11" }
];

// First API call: the model sees the user's request and available tools.
const response = await client.responses.create({
  model: "gpt-5",
  instructions: systemPrompt,
  input: context,
  tools: toolSchemas,
  tool_choice: "required",
  reasoning: { effort: "low" }
});

// Process the first model response: execute any function calls and add results to context.
// This is the key pattern: LLM calls functions -> we execute them -> we add results back to context.
for (const item of response.output.filter(isFunctionCall)) {
  // Step 1: Add the function call to context.
  // This records what function the model decided to call.
  context.push({
    type: "function_call",
    name: item.name,
    arguments: item.arguments,
    call_id: item.call_id
  });

  // Step 2: Execute the function call.
  // Parse the JSON arguments and call the actual TypeScript function.
  const args = JSON.parse(item.arguments) as { a: number; b: number };
  const result = item.name === "add" ? add(args.a, args.b) : multiply(args.a, args.b);

  console.log(`Executed ${item.name}(${JSON.stringify(args)}) = ${result}`);

  // Step 3: Add the function result back to context.
  // The model needs to see the result to continue its reasoning.
  // Use the same call_id to link the result to the original call.
  context.push({
    type: "function_call_output",
    call_id: item.call_id,
    output: JSON.stringify({ result })
  });
}

// Second API call: the model sees the function calls and their results.
// It can now continue with another step or provide a final answer.
const finalResponse = await client.responses.create({
  model: "gpt-5",
  instructions: systemPrompt,
  input: context,
  tools: toolSchemas,
  tool_choice: "required",
  reasoning: { effort: "low" }
});

console.log("\nFinal response:");
console.log(finalResponse.output_text);

function isFunctionCall(
  value: ResponseOutputItem
): value is ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string } {
  return value.type === "function_call";
}
```

### Unit 4 - Controlling Loops of Agentic Tool-Use
#### Goal
Build an agentic loop that repeatedly calls the model, executes tools, and updates context until completion or a step limit. This implements Factor 8 through explicit loop management and Factor 9 by returning execution failures as compact tool outputs.

#### Files

`main.ts`
```typescript
import OpenAI from "openai";
import type { ResponseOutputItem, Tool } from "openai/resources/responses/responses";

// Define the functions we want to make available to the model.
function add(a: number, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

type ContextItem =
  | { role: "user"; content: string }
  | { type: "function_call"; name: string; arguments: string; call_id: string }
  | { type: "function_call_output"; call_id: string; output: string };

// Define tool schemas including a special final_answer tool.
const toolSchemas: Tool[] = [
  {
    type: "function",
    name: "add",
    description: "Add two numbers together",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number", description: "The first number" },
        b: { type: "number", description: "The second number" }
      },
      required: ["a", "b"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "multiply",
    description: "Multiply two numbers together",
    parameters: {
      type: "object",
      properties: {
        a: { type: "number", description: "The first number" },
        b: { type: "number", description: "The second number" }
      },
      required: ["a", "b"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "final_answer",
    description: "Provide the final answer and stop.",
    parameters: {
      type: "object",
      properties: {
        answer: { type: "string", description: "The final answer for the user." }
      },
      required: ["answer"],
      additionalProperties: false
    }
  }
];

const client = new OpenAI();

const systemPrompt = `
You are a helpful assistant that can perform calculations.
When asked to do math, you must use the provided tools.
When your work is done, call the final_answer tool.
`;

// Initialize context with the user's message.
const context: ContextItem[] = [
  { role: "user", content: "What is 15 + 27? Then multiply the result by 3." }
];

// Set up loop control variables.
const maxSteps = 10;
let step = 0;
let done = false;
let finalAnswer: string | null = null;

// Main agent loop: continue until done or max steps reached.
while (!done && step < maxSteps) {
  step += 1;
  console.log(`\n--- Step ${step} ---`);

  // Call the LLM with current context.
  const response = await client.responses.create({
    model: "gpt-5",
    instructions: systemPrompt,
    input: context,
    tools: toolSchemas,
    tool_choice: "required",
    reasoning: { effort: "low" }
  });

  // Process each item in the response output.
  for (const item of response.output) {
    if (!isFunctionCall(item)) {
      continue;
    }

    const args = JSON.parse(item.arguments) as Record<string, unknown>;
    console.log(`Calling function: ${item.name}(${JSON.stringify(args)})`);

    // Add function call to context.
    context.push({ type: "function_call", name: item.name, arguments: item.arguments, call_id: item.call_id });

    if (item.name === "final_answer") {
      // final_answer is the model's signal that the loop can stop.
      finalAnswer = typeof args.answer === "string" ? args.answer : null;
      done = true;
      console.log(`Final answer: ${finalAnswer}`);
      break;
    }

    // Execute tools with explicit cases so application control flow stays visible.
    let output: string;
    switch (item.name) {
      case "add":
        try {
          const result = add(requireNumber(args.a), requireNumber(args.b));
          output = JSON.stringify({ result });
          console.log(`Result: ${result}`);
        } catch (error) {
          output = compactToolError(error);
        }
        break;
      case "multiply":
        try {
          const result = multiply(requireNumber(args.a), requireNumber(args.b));
          output = JSON.stringify({ result });
          console.log(`Result: ${result}`);
        } catch (error) {
          output = compactToolError(error);
        }
        break;
      default:
        output = JSON.stringify({ error: `Tool ${item.name} not found` });
    }

    context.push({ type: "function_call_output", call_id: item.call_id, output });
  }
}

if (!done) {
  console.log(`\nReached maximum steps (${maxSteps})`);
}

console.log(`\nCompleted in ${step} steps`);
if (finalAnswer) {
  console.log(`Final answer: ${finalAnswer}`);
}

function requireNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Tool argument must be a finite number");
  }

  return value;
}

function compactToolError(error: unknown): string {
  // Errors are compacted into context so the model can recover.
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ error: message });
}

function isFunctionCall(
  value: ResponseOutputItem
): value is ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string } {
  return value.type === "function_call";
}
```

---

# Course 3: Developing a Stateless Agent in TypeScript

## Overview
Turn scripts into reusable components by embracing strict types and stateless design. With Factors 2, 5, 10, and 12, students externalize prompts, unify execution and business state, and build a reducer-style agent that takes state in and returns state out.

## Outline
### Unit 1 - Designing a Stateless Reducer Agent
#### Goal
Build an `Agent` class that processes typed context, executes tools through a small dispatcher, and returns updated state. This implements Factor 12 and Factor 10.

#### Files

`src/core/models/state.ts`
```typescript
export type AgentStatus = "running" | "complete" | "failed" | "max_steps_reached";

export type ContextItem =
  | { role: "user"; content: string }
  | { type: "function_call"; name: string; arguments: string; call_id: string }
  | { type: "function_call_output"; call_id: string; output: string };

export interface RunResult {
  context: ContextItem[];
  status: AgentStatus;
  finalAnswer: string | null;
}
```

`src/core/tools/functions/math.ts`
```typescript
// Tools are ordinary TypeScript functions.
export function sumNumbers(a: number, b: number): number {
  return a + b;
}

export function multiplyNumbers(a: number, b: number): number {
  return a * b;
}

export function subtractNumbers(a: number, b: number): number {
  return a - b;
}

export function divideNumbers(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero");
  }

  return a / b;
}

export function power(base: number, exponent: number): number {
  return base ** exponent;
}

export function squareRoot(x: number): number {
  if (x < 0) {
    throw new Error("Square root of negative number");
  }

  return Math.sqrt(x);
}
```

`src/core/tools/schemas/math.json`
```json
[
  {
    "type": "function",
    "name": "sum_numbers",
    "description": "Sum two numbers",
    "parameters": {
      "type": "object",
      "properties": {
        "a": { "type": "number", "description": "The first number" },
        "b": { "type": "number", "description": "The second number" }
      },
      "required": ["a", "b"],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "multiply_numbers",
    "description": "Multiply two numbers",
    "parameters": {
      "type": "object",
      "properties": {
        "a": { "type": "number", "description": "The first number" },
        "b": { "type": "number", "description": "The second number" }
      },
      "required": ["a", "b"],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "subtract_numbers",
    "description": "Subtract two numbers",
    "parameters": {
      "type": "object",
      "properties": {
        "a": { "type": "number", "description": "The first number" },
        "b": { "type": "number", "description": "The second number" }
      },
      "required": ["a", "b"],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "divide_numbers",
    "description": "Divide two numbers",
    "parameters": {
      "type": "object",
      "properties": {
        "a": { "type": "number", "description": "The numerator" },
        "b": { "type": "number", "description": "The denominator" }
      },
      "required": ["a", "b"],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "power",
    "description": "Raise a number to a power",
    "parameters": {
      "type": "object",
      "properties": {
        "base": { "type": "number", "description": "The base number" },
        "exponent": { "type": "number", "description": "The exponent" }
      },
      "required": ["base", "exponent"],
      "additionalProperties": false
    }
  },
  {
    "type": "function",
    "name": "square_root",
    "description": "Take the square root of a number",
    "parameters": {
      "type": "object",
      "properties": {
        "x": { "type": "number", "description": "The number to take the square root of" }
      },
      "required": ["x"],
      "additionalProperties": false
    }
  }
]
```

`src/core/tools/schemas/final_answer.json`
```json
{
  "type": "function",
  "name": "final_answer",
  "description": "Provide the final answer and stop.",
  "parameters": {
    "type": "object",
    "properties": {
      "answer": { "type": "string", "description": "The final answer for the user." }
    },
    "required": ["answer"],
    "additionalProperties": false
  }
}
```

`src/core/agent.ts`
```typescript
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type { ResponseOutputItem, Tool } from "openai/resources/responses/responses";

import type { ContextItem, RunResult } from "./models/state.js";
import {
  divideNumbers,
  multiplyNumbers,
  power,
  squareRoot,
  subtractNumbers,
  sumNumbers
} from "./tools/functions/math.js";

export class Agent {
  private readonly client = new OpenAI();
  private readonly model: string;
  private readonly maxSteps: number;
  private readonly systemPrompt: string;
  private readonly toolSchemas: Tool[];

  constructor(model = "gpt-5", maxSteps = 10) {
    this.model = model;
    this.maxSteps = maxSteps;
    // Keep prompt inline in Unit 1; Unit 2 externalizes it.
    this.systemPrompt =
      "You are a helpful assistant. When your work is done, call the final_answer tool. Prefer using tools to compute results.";

    // Load tool schemas from JSON files.
    const schemasDir = join(dirname(fileURLToPath(import.meta.url)), "tools", "schemas");
    const mathSchemas = JSON.parse(readFileSync(join(schemasDir, "math.json"), "utf8")) as Tool[];
    const finalAnswerSchema = JSON.parse(readFileSync(join(schemasDir, "final_answer.json"), "utf8")) as Tool;
    this.toolSchemas = [...mathSchemas, finalAnswerSchema];
  }

  private async callLlm(context: ContextItem[]): Promise<ResponseOutputItem[]> {
    // Pass full context directly in Unit 1.
    const response = await this.client.responses.create({
      model: this.model,
      instructions: this.systemPrompt,
      input: context,
      tools: this.toolSchemas,
      tool_choice: "required",
      reasoning: this.model === "gpt-5" ? { effort: "low" } : undefined
    });

    return response.output;
  }

  private async nextStep(context: ContextItem[]): Promise<RunResult> {
    // One step: ask the model for tool calls, then execute them.
    const responseItems = await this.callLlm(context);

    for (const item of responseItems) {
      if (!isFunctionCall(item)) {
        continue;
      }

      const args = JSON.parse(item.arguments) as Record<string, unknown>;
      context.push({ type: "function_call", name: item.name, arguments: item.arguments, call_id: item.call_id });

      if (item.name === "final_answer") {
        // Stop when the model signals completion.
        return {
          context,
          status: "complete",
          finalAnswer: typeof args.answer === "string" ? args.answer : null
        };
      }

      // Execute the requested tool and capture its output.
      // Each tool is an explicit case so the control flow remains owned by the app.
      let output: string;
      switch (item.name) {
        case "sum_numbers":
          try {
            output = JSON.stringify({ result: sumNumbers(numberArg(args, "a"), numberArg(args, "b")) });
          } catch (error) {
            output = compactToolError(error);
          }
          break;
        case "multiply_numbers":
          try {
            output = JSON.stringify({ result: multiplyNumbers(numberArg(args, "a"), numberArg(args, "b")) });
          } catch (error) {
            output = compactToolError(error);
          }
          break;
        case "subtract_numbers":
          try {
            output = JSON.stringify({ result: subtractNumbers(numberArg(args, "a"), numberArg(args, "b")) });
          } catch (error) {
            output = compactToolError(error);
          }
          break;
        case "divide_numbers":
          try {
            output = JSON.stringify({ result: divideNumbers(numberArg(args, "a"), numberArg(args, "b")) });
          } catch (error) {
            output = compactToolError(error);
          }
          break;
        case "power":
          try {
            output = JSON.stringify({ result: power(numberArg(args, "base"), numberArg(args, "exponent")) });
          } catch (error) {
            output = compactToolError(error);
          }
          break;
        case "square_root":
          try {
            output = JSON.stringify({ result: squareRoot(numberArg(args, "x")) });
          } catch (error) {
            output = compactToolError(error);
          }
          break;
        default:
          output = JSON.stringify({ result: `Error: Tool ${item.name} not found` });
      }

      context.push({ type: "function_call_output", call_id: item.call_id, output });
    }

    // No completion yet; keep running.
    return { context, status: "running", finalAnswer: null };
  }

  async run(context: ContextItem[]): Promise<RunResult> {
    // Reducer loop: context in, context out.
    let step = 0;
    let status: RunResult["status"] = "running";
    let finalAnswer: string | null = null;

    // Loop until complete or max steps reached.
    while (status === "running" && step < this.maxSteps) {
      step += 1;
      // Each step processes function calls and updates context.
      const result = await this.nextStep(context);
      context = result.context;
      status = result.status;
      finalAnswer = result.finalAnswer;
    }

    // Handle max steps case.
    if (status === "running") {
      status = "max_steps_reached";
    }

    // Return the final state.
    return { context, status, finalAnswer };
  }
}

function numberArg(args: Record<string, unknown>, name: string): number {
  const value = args[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}

function compactToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ result: `Error: ${message}` });
}

function isFunctionCall(
  value: ResponseOutputItem
): value is ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string } {
  return value.type === "function_call";
}
```

`src/main.ts`
```typescript
import { Agent } from "./core/agent.js";
import type { ContextItem } from "./core/models/state.js";

const agent = new Agent("gpt-5", 10);

const context: ContextItem[] = [
  {
    role: "user",
    content: "Solve the root of this equation: x^2 - 5x + 6 = 0"
  }
];

const result = await agent.run(context);

console.log(`Status: ${result.status}`);
console.log(`Final answer: ${result.finalAnswer}`);
```

### Unit 2 - Taking Ownership of Our Prompts
#### Goal
Extract prompts and context formats into versioned markdown files, then use a serializer to control what the model sees. This covers Factors 2 and 3.

#### Files

`src/core/prompts/base_system.md`
```markdown
# ROLE
You are an autonomous agent that can take multiple tool-calling steps.

# REQUIREMENTS
- If your work is done, call the final_answer tool
- If you need to ask clarification to the user, use the ask_human tool
- ALWAYS prefer calling tools to compute, fetch, or transform information rather than fabricating results.

# EXTRA INSTRUCTIONS
```

`src/core/prompts/context_format.md`
```markdown
# User Request
{user_message}

# Actions Already Completed (DO NOT REPEAT)

{execution_history}

# Next Step
Decide what tool to call next to make progress on the request.
```

`src/core/utils/contextSerializer.ts`
```typescript
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ContextItem } from "../models/state.js";

const templatePath = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts", "context_format.md");
const template = readFileSync(templatePath, "utf8");

export function serializeContextToText(context: ContextItem[]): string {
  // Extract the original user request from structured context.
  const userMessage = context.find((item) => "role" in item && item.role === "user")?.content ?? "";
  // Format completed tool calls and outputs into a readable execution history.
  const executionHistory = buildCompletedActionLines(context);

  // Fill the owned markdown template with exactly the context we want the model to see.
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
    return "None";
  }

  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }

  return String(value);
}
```

`src/core/agent.ts`
```typescript
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type { ResponseOutputItem, Tool } from "openai/resources/responses/responses";

import type { ContextItem, RunResult } from "./models/state.js";
import { multiplyNumbers, sumNumbers } from "./tools/functions/math.js";
import { serializeContextToText } from "./utils/contextSerializer.js";

export class Agent {
  private readonly client = new OpenAI();
  private readonly systemPrompt: string;
  private readonly toolSchemas: Tool[];

  constructor(private readonly maxSteps = 10) {
    const baseDir = dirname(fileURLToPath(import.meta.url));
    // Load system prompt from file (Factor 2).
    this.systemPrompt = readFileSync(join(baseDir, "prompts", "base_system.md"), "utf8");
    this.toolSchemas = [
      ...JSON.parse(readFileSync(join(baseDir, "tools", "schemas", "math.json"), "utf8")),
      JSON.parse(readFileSync(join(baseDir, "tools", "schemas", "final_answer.json"), "utf8"))
    ] as Tool[];
  }

  private async callLlm(context: ContextItem[]): Promise<ResponseOutputItem[]> {
    // Serialize context to control what the model sees (Factor 3).
    const input = serializeContextToText(context);
    const response = await this.client.responses.create({
      model: "gpt-5",
      instructions: this.systemPrompt,
      input,
      tools: this.toolSchemas,
      tool_choice: "required",
      reasoning: { effort: "low" }
    });

    return response.output;
  }

  async run(context: ContextItem[]): Promise<RunResult> {
    // Main entry point: run the agent until done or max steps.
    let step = 0;
    let status: RunResult["status"] = "running";
    let finalAnswer: string | null = null;

    while (status === "running" && step < this.maxSteps) {
      step += 1;
      const responseItems = await this.callLlm(context);

      for (const item of responseItems) {
        if (!isFunctionCall(item)) {
          continue;
        }

        const args = JSON.parse(item.arguments) as Record<string, unknown>;
        context.push({ type: "function_call", name: item.name, arguments: item.arguments, call_id: item.call_id });

        if (item.name === "final_answer") {
          status = "complete";
          finalAnswer = typeof args.answer === "string" ? args.answer : null;
          break;
        }

        // Execute each tool through an explicit case.
        let output: string;
        switch (item.name) {
          case "sum_numbers":
            try {
              output = JSON.stringify({ result: sumNumbers(numberArg(args, "a"), numberArg(args, "b")) });
            } catch (error) {
              output = compactToolError(error);
            }
            break;
          case "multiply_numbers":
            try {
              output = JSON.stringify({ result: multiplyNumbers(numberArg(args, "a"), numberArg(args, "b")) });
            } catch (error) {
              output = compactToolError(error);
            }
            break;
          default:
            output = JSON.stringify({ result: `Error: Tool ${item.name} not found` });
        }

        context.push({ type: "function_call_output", call_id: item.call_id, output });
      }
    }

    if (status === "running") {
      status = "max_steps_reached";
    }

    return { context, status, finalAnswer };
  }
}

function numberArg(args: Record<string, unknown>, name: string): number {
  const value = args[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}

function compactToolError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ result: `Error: ${message}` });
}

function isFunctionCall(
  value: ResponseOutputItem
): value is ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string } {
  return value.type === "function_call";
}
```

`src/main.ts`
```typescript
import { Agent } from "./core/agent.js";
import type { ContextItem } from "./core/models/state.js";

const agent = new Agent(10);

const context: ContextItem[] = [
  {
    role: "user",
    content: "Solve the root of this equation: x^2 - 5x + 6 = 0"
  }
];

const result = await agent.run(context);

console.log(`Status: ${result.status}`);
console.log(`Final answer: ${result.finalAnswer}`);
console.log("\nFinal context:");
for (const item of result.context) {
  console.log(item);
}
```

### Unit 3 - Unifying Execution and Business States
#### Goal
Create a unified `State` object that includes steps, status, context, pending tool calls, errors, and final answer. Students learn Factor 5 by removing hidden runtime state from the agent.

#### Files

`src/core/models/state.ts`
```typescript
export type AgentStatus = "running" | "complete" | "failed" | "max_steps_reached";

export type ContextItem =
  | { role: "user"; content: string }
  | { type: "function_call"; name: string; arguments: string; call_id: string }
  | { type: "function_call_output"; call_id: string; output: string };

// Pending tool calls are stored separately until the reducer executes them.
export interface PendingToolCall {
  type: "function_call";
  name: string;
  arguments: Record<string, unknown>;
  call_id: string;
}

// Unified state carries execution state and business state together.
export interface State {
  id: string;
  steps: number;
  status: AgentStatus;
  context: ContextItem[];
  pending_tool_calls: PendingToolCall[];
  error: string | null;
  final_answer: string | null;
}
```

`src/core/agent.ts`
```typescript
import OpenAI from "openai";
import type { ResponseOutputItem, Tool } from "openai/resources/responses/responses";

import type { PendingToolCall, State } from "./models/state.js";
import { serializeContextToText } from "./utils/contextSerializer.js";

export class Agent {
  private readonly client = new OpenAI();

  constructor(
    private readonly toolSchemas: Tool[],
    private readonly systemPrompt: string,
    private readonly maxSteps = 10
  ) {}

  async run(inputState: State): Promise<State> {
    // Create a deep copy to avoid mutating the original.
    let state = structuredClone(inputState);
    state.status = "running";

    while (state.status === "running" && state.steps < this.maxSteps) {
      state = await this.nextStep(state);
    }

    if (state.status === "running") {
      state.status = "max_steps_reached";
    }

    return state;
  }

  private async nextStep(state: State): Promise<State> {
    // State carries both execution and business data (Factor 5).
    state.steps += 1;

    // Execute pending tool calls before asking the model for another step.
    for (const functionCall of [...state.pending_tool_calls]) {
      // Persist the tool call into unified context history.
      state.context.push({
        type: "function_call",
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.arguments),
        call_id: functionCall.call_id
      });

      if (functionCall.name === "final_answer") {
        // final_answer completes the workflow and stores the answer in business state.
        state.pending_tool_calls = [];
        state.status = "complete";
        state.final_answer = typeof functionCall.arguments.answer === "string" ? functionCall.arguments.answer : null;
        return state;
      }

      // Execute the requested tool and compact success or failure into context.
      const output = JSON.stringify({ result: `Executed ${functionCall.name}` });
      state.pending_tool_calls = state.pending_tool_calls.filter((call) => call.call_id !== functionCall.call_id);
      // Store tool output in the same state object.
      state.context.push({ type: "function_call_output", call_id: functionCall.call_id, output });
    }

    // Ask the model what tool call should happen next.
    const response = await this.client.responses.create({
      model: "gpt-5",
      instructions: this.systemPrompt,
      input: serializeContextToText(state.context),
      tools: this.toolSchemas,
      tool_choice: "required",
      reasoning: { effort: "low" }
    });

    // Queue new tool calls inside the unified state for the next step.
    state.pending_tool_calls.push(...response.output.filter(isFunctionCall).map(toPendingToolCall));
    return state;
  }
}

function toPendingToolCall(item: ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string }): PendingToolCall {
  return {
    type: "function_call",
    name: item.name,
    arguments: JSON.parse(item.arguments) as Record<string, unknown>,
    call_id: item.call_id
  };
}

function isFunctionCall(
  value: ResponseOutputItem
): value is ResponseOutputItem & { type: "function_call"; name: string; arguments: string; call_id: string } {
  return value.type === "function_call";
}
```

`src/main.ts`
```typescript
import { randomUUID } from "node:crypto";
import { Agent } from "./core/agent.js";
import type { State } from "./core/models/state.js";

const agent = new Agent([], "You are a helpful assistant.", 10);

const state: State = {
  id: randomUUID(),
  steps: 0,
  status: "running",
  context: [
    {
      role: "user",
      content: "Solve the root of this equation: x^2 - 5x + 6 = 0"
    }
  ],
  pending_tool_calls: [],
  error: null,
  final_answer: null
};

const finalState = await agent.run(state);

console.log(`Status: ${finalState.status}`);
console.log(`Final answer: ${finalState.final_answer}`);
```

---

# Course 4: Exposing Agents with Simple APIs in TypeScript

## Overview
Expose the stateless agent as a backend service. With Factors 5, 6, 7, and 11, students persist unified state, orchestrate runs through REST endpoints, add pause/resume controls, wire human responses back into waiting workflows, and decouple the agent from any one interface.

This course focuses on the backend. The frontend can call the same API, but students build and reason about the server, persistence layer, and CLI client.

## Outline
### Unit 1 - Launching Agents with Express APIs
#### Goal
Build an Express API with endpoints to launch agents and retrieve state. By decoupling agent logic from the interface and exposing it through REST, this unit implements Factor 11.

#### Files

`src/server/main.ts`
```typescript
import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { type Request, type Response } from "express";

import { Agent } from "../core/agent.js";
import type { State } from "../core/models/state.js";
import { createInitialState } from "../core/models/state.js";

const port = Number(process.env.PORT ?? 8000);
const host = process.env.HOST ?? "0.0.0.0";
const app = express();
const agent = new Agent({ maxSteps: 10 });

// In-memory storage will be replaced with SQLite in the next unit.
const states = new Map<string, State>();

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json());

app.post("/agent/launch", (request: Request, response: Response) => {
  const inputPrompt = requireStringField(request.body, "input_prompt");
  const initialState = createInitialState(randomUUID(), inputPrompt);

  // Store the state before background work starts so clients can poll immediately.
  states.set(initialState.id, initialState);
  void runAgentInBackground(initialState.id);

  response.json(initialState);
});

app.get("/agent/state/:stateId", (request: Request, response: Response) => {
  const stateId = requireStringField(request.params, "stateId");
  const state = states.get(stateId);
  if (!state) {
    response.status(404).json({ detail: "State not found" });
    return;
  }

  response.json(state);
});

app.listen(port, host, () => {
  console.log(`Backend API listening on http://${host}:${port}`);
});

async function runAgentInBackground(stateId: string): Promise<void> {
  const state = states.get(stateId);
  if (!state) {
    return;
  }

  // The request returns immediately while the agent continues in the background.
  const finalState = await agent.run(state);
  states.set(stateId, finalState);
}

function requireStringField(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Request body must be an object");
  }

  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value;
}
```

`src/client/main.ts`
```typescript
import type { State } from "../core/models/state.js";

const baseUrl = "http://localhost:8000";

// Launch a new workflow through the REST API.
const launchResponse = await fetch(`${baseUrl}/agent/launch`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ input_prompt: "Solve the roots of this equation: x^2 - 5x + 6 = 0" })
});
const launched = (await launchResponse.json()) as State;
console.log(`Launched agent with ID: ${launched.id}`);

// Poll the backend until the run reaches a terminal state.
while (true) {
  const stateResponse = await fetch(`${baseUrl}/agent/state/${encodeURIComponent(launched.id)}`);
  const state = (await stateResponse.json()) as State;
  console.log(`Status: ${state.status}, Steps: ${state.steps}`);

  if (["complete", "failed", "max_steps_reached"].includes(state.status)) {
    console.log(`Final answer: ${state.final_answer}`);
    break;
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));
}
```

### Unit 2 - Persisting States with SQLite and Callbacks
#### Goal
Replace in-memory storage with SQLite and add progress callbacks that save state after each agent step. This implements Factor 5 with a durable state table while keeping the agent itself stateless.

#### Files

`src/server/database.ts`
```typescript
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

function parseStatus(value: string): AgentStatus {
  switch (value) {
    case "running":
    case "paused":
    case "complete":
    case "failed":
    case "waiting_human_input":
    case "max_steps_reached":
      return value;
    default:
      throw new Error(`Unknown state status: ${value}`);
  }
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
```

`src/server/main.ts`
```typescript
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8000);
const host = process.env.HOST ?? "0.0.0.0";

const app = createApp();

app.listen(port, host, () => {
  console.log(`Backend API listening on http://${host}:${port}`);
});
```

### Unit 3 - Pausing and Resuming Agents Through API Calls
#### Goal
Add lifecycle endpoints that pause a running workflow and resume a saved workflow. Students learn Factor 6 by making lifecycle controls explicit API operations.

#### Files

`src/server/app.ts`
```typescript
import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { Agent } from "../core/agent.js";
import type { FunctionCallContextItem, State } from "../core/models/state.js";
import { createInitialState } from "../core/models/state.js";
import { StateStore } from "./database.js";

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export interface AppDependencies {
  agent?: Agent;
  store?: StateStore;
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function createApp(dependencies: AppDependencies = {}): express.Express {
  const app = express();
  const store = dependencies.store ?? new StateStore();
  const agent = dependencies.agent ?? new Agent({ maxSteps: 10 });

  app.use(cors({ origin: "*", credentials: false }));
  app.use(express.json());

  app.post(
    "/agent/launch",
    asyncHandler(async (request, response) => {
      const inputPrompt = requireStringField(request.body, "input_prompt");
      const initialState = createInitialState(randomUUID(), inputPrompt);

      store.save(initialState);
      void runAgentInBackground(store, agent, initialState.id);

      response.json(initialState);
    })
  );

  app.get(
    "/agent/state/:stateId",
    asyncHandler(async (request, response) => {
      const stateId = requireRouteParam(request.params.stateId, "stateId");
      const state = store.get(stateId);
      if (!state) {
        throw new HttpError(404, "State not found");
      }

      response.json(state);
    })
  );

  app.post(
    "/agent/pause",
    asyncHandler(async (request, response) => {
      const id = requireStringField(request.body, "id");
      const updated = store.update(id, (state) => {
        if (state.status !== "running") {
          throw new HttpError(
            400,
            `Cannot pause agent. Current status: ${state.status}. Only agents with status 'running' can be paused.`
          );
        }

        return { ...state, status: "paused" };
      });

      if (!updated) {
        throw new HttpError(404, "State not found");
      }

      response.json(updated);
    })
  );

  app.post(
    "/agent/resume",
    asyncHandler(async (request, response) => {
      const id = requireStringField(request.body, "id");
      const current = store.get(id);

      if (!current) {
        throw new HttpError(404, "State not found");
      }

      if (current.status === "running") {
        throw new HttpError(409, "Agent is already running for this state");
      }

      if (current.status === "waiting_human_input") {
        throw new HttpError(400, "Agent is waiting for human input");
      }

      // Clear previous errors before continuing from saved state.
      const workingState = store.save({ ...current, error: null });
      void runAgentInBackground(store, agent, id, workingState);

      response.json(workingState);
    })
  );

  app.use((_request, _response, next) => {
    next(new HttpError(404, "Not found"));
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : String(error);
    response.status(statusCode).json({ detail: message });
  });

  return app;
}

async function runAgentInBackground(
  store: StateStore,
  agent: Agent,
  stateId: string,
  workingState?: State
): Promise<void> {
  try {
    let initialState = workingState;
    if (!initialState) {
      const persisted = store.get(stateId);
      if (!persisted) {
        return;
      }

      initialState = store.save({ ...persisted, status: "running", error: null });
    } else {
      store.save({ ...initialState, status: "running", error: null });
    }

    const finalState = await agent.run(initialState, async (state) => {
      const persisted = store.get(stateId);
      if (persisted?.status === "paused") {
        state.status = "paused";
        store.save({ ...state, status: "paused" });
        return;
      }

      store.save(state);
    });

    store.save(finalState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const state = store.get(stateId);
    if (state) {
      store.save({ ...state, status: "failed", error: message, pending_tool_calls: [] });
    }
  }
}

function asyncHandler(route: AsyncRoute): AsyncRoute {
  return async (request, response, next) => {
    try {
      await route(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}

function requireStringField(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be an object");
  }

  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${field} must be a non-empty string`);
  }

  return value;
}

function requireRouteParam(value: string | string[] | undefined, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${field} must be a non-empty string`);
  }

  return value;
}

function getAskHumanCallId(state: State): string | null {
  for (const item of [...state.context].reverse()) {
    if (isAskHumanFunctionCall(item)) {
      return item.call_id;
    }
  }

  return null;
}

function isAskHumanFunctionCall(value: unknown): value is FunctionCallContextItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "function_call" &&
    "name" in value &&
    value.name === "ask_human" &&
    "call_id" in value &&
    typeof value.call_id === "string"
  );
}
```

### Unit 4 - Integrating Human Input Back to Agents
#### Goal
Create an API endpoint that accepts human input for waiting agents and resumes execution with that response. This completes Factor 7 by modeling human escalation as a tool call and response pair.

#### Files

`src/server/app.ts`
```typescript
import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { Agent } from "../core/agent.js";
import type { FunctionCallContextItem, State } from "../core/models/state.js";
import { createInitialState } from "../core/models/state.js";
import { StateStore } from "./database.js";

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export interface AppDependencies {
  agent?: Agent;
  store?: StateStore;
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function createApp(dependencies: AppDependencies = {}): express.Express {
  const app = express();
  const store = dependencies.store ?? new StateStore();
  const agent = dependencies.agent ?? new Agent({ maxSteps: 10 });

  app.use(cors({ origin: "*", credentials: false }));
  app.use(express.json());

  app.post(
    "/agent/launch",
    asyncHandler(async (request, response) => {
      const inputPrompt = requireStringField(request.body, "input_prompt");
      const initialState = createInitialState(randomUUID(), inputPrompt);

      store.save(initialState);
      void runAgentInBackground(store, agent, initialState.id);

      response.json(initialState);
    })
  );

  app.get(
    "/agent/state/:stateId",
    asyncHandler(async (request, response) => {
      const stateId = requireRouteParam(request.params.stateId, "stateId");
      const state = store.get(stateId);
      if (!state) {
        throw new HttpError(404, "State not found");
      }

      response.json(state);
    })
  );

  app.post(
    "/agent/provide_input",
    asyncHandler(async (request, response) => {
      const id = requireStringField(request.body, "id");
      const answer = requireStringField(request.body, "answer");
      const current = store.get(id);

      if (!current) {
        throw new HttpError(404, "State not found");
      }

      if (current.status !== "waiting_human_input") {
        throw new HttpError(400, `State is not waiting for human input. Current status: ${current.status}`);
      }

      const callId = getAskHumanCallId(current);
      if (!callId) {
        throw new HttpError(400, "Could not find ask_human call in state context");
      }

      const workingState: State = {
        ...current,
        context: [
          ...current.context,
          {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ answer })
          }
        ]
      };

      store.save({ ...workingState, status: "running" });
      void runAgentInBackground(store, agent, id, workingState);

      response.json(workingState);
    })
  );

  app.post(
    "/agent/pause",
    asyncHandler(async (request, response) => {
      const id = requireStringField(request.body, "id");
      const updated = store.update(id, (state) => {
        if (state.status !== "running") {
          throw new HttpError(
            400,
            `Cannot pause agent. Current status: ${state.status}. Only agents with status 'running' can be paused.`
          );
        }

        return { ...state, status: "paused" };
      });

      if (!updated) {
        throw new HttpError(404, "State not found");
      }

      response.json(updated);
    })
  );

  app.post(
    "/agent/resume",
    asyncHandler(async (request, response) => {
      const id = requireStringField(request.body, "id");
      const current = store.get(id);

      if (!current) {
        throw new HttpError(404, "State not found");
      }

      if (current.status === "running") {
        throw new HttpError(409, "Agent is already running for this state");
      }

      if (current.status === "waiting_human_input") {
        throw new HttpError(400, "Agent is waiting for human input");
      }

      const workingState = store.save({ ...current, error: null });
      void runAgentInBackground(store, agent, id, workingState);

      response.json(workingState);
    })
  );

  app.use((_request, _response, next) => {
    next(new HttpError(404, "Not found"));
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : String(error);
    response.status(statusCode).json({ detail: message });
  });

  return app;
}

async function runAgentInBackground(
  store: StateStore,
  agent: Agent,
  stateId: string,
  workingState?: State
): Promise<void> {
  try {
    let initialState = workingState;
    if (!initialState) {
      const persisted = store.get(stateId);
      if (!persisted) {
        return;
      }

      initialState = store.save({ ...persisted, status: "running", error: null });
    } else {
      store.save({ ...initialState, status: "running", error: null });
    }

    const finalState = await agent.run(initialState, async (state) => {
      const persisted = store.get(stateId);
      if (persisted?.status === "paused") {
        state.status = "paused";
        store.save({
          ...state,
          status: "paused"
        });
        return;
      }

      store.save(state);
    });

    store.save(finalState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const state = store.get(stateId);
    if (state) {
      store.save({
        ...state,
        status: "failed",
        error: message,
        pending_tool_calls: []
      });
    }
  }
}

function asyncHandler(route: AsyncRoute): AsyncRoute {
  return async (request, response, next) => {
    try {
      await route(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}

function requireStringField(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be an object");
  }

  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${field} must be a non-empty string`);
  }

  return value;
}

function requireRouteParam(value: string | string[] | undefined, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${field} must be a non-empty string`);
  }

  return value;
}

function getAskHumanCallId(state: State): string | null {
  for (const item of [...state.context].reverse()) {
    if (isAskHumanFunctionCall(item)) {
      return item.call_id;
    }
  }

  return null;
}

function isAskHumanFunctionCall(value: unknown): value is FunctionCallContextItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "function_call" &&
    "name" in value &&
    value.name === "ask_human" &&
    "call_id" in value &&
    typeof value.call_id === "string"
  );
}
```

### Unit 5 - Controlling Agents from a Backend CLI Client
#### Goal
Demonstrate that the same backend API can be triggered from a command-line client. This reinforces Factor 11 without making the frontend part of the course material.


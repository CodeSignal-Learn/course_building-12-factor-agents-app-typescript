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
```ts
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

// Parse the output text to extract the JSON answer.
const result = JSON.parse(response.output_text) as { answer?: string };
// Extract and print the answer field.
console.log(`Answer: ${result.answer}`);
```

### Unit 2 - Defining a Tool Schema and Requiring Tool Use
#### Goal
Write a tool schema, provide it to the model, and handle the tool-call output. Students reinforce Factor 4 by parsing a structured function call and requiring tool use with `tool_choice: "required"`.

#### Files
`main.ts`
```ts
import OpenAI from "openai";

// Create the official OpenAI SDK client.
const client = new OpenAI();

// Define a single tool schema for final_answer.
// The model must call this function instead of returning ordinary text.
const toolSchemas = [
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

// Narrow unknown response items into the function-call shape we expect.
function isFunctionCall(value: unknown): value is { type: "function_call"; name: string; arguments: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "function_call" &&
    "name" in value &&
    typeof value.name === "string" &&
    "arguments" in value &&
    typeof value.arguments === "string"
  );
}
```

### Unit 3 - Executing Tool Calls and Managing Context
#### Goal
Demonstrate executing function calls from model responses and feeding results back into explicit context. This introduces Factor 3 by showing that the application owns what the model sees next.

#### Files
`main.ts`
```ts
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

// Initialize context with the user's message.
const context: ContextItem[] = [
  { role: "user", content: "Compute 15 + 27 and 8 * 11" }
];

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

  // Step 3: Add the function result back to context.
  // The model needs to see the result to continue its reasoning.
  // Use the same call_id to link the result to the original call.
  context.push({
    type: "function_call_output",
    call_id: item.call_id,
    output: JSON.stringify({ result })
  });
}

// The next model request receives the updated context.
// It can now continue with another step or provide a final answer.
```

### Unit 4 - Controlling Loops of Agentic Tool-Use
#### Goal
Build an agentic loop that repeatedly calls the model, executes tools, and updates context until completion or a step limit. This implements Factor 8 through explicit loop management and Factor 9 by returning execution failures as compact tool outputs.

#### Files
`main.ts`
```ts
// Set up loop control variables.
let step = 0;
let done = false;
let finalAnswer: string | null = null;

// Main agent loop: continue until done or max steps reached.
while (!done && step < 10) {
  step += 1;
  // Call the LLM with the current context.
  const response = await callModel(context);

  // Process each item in the response output.
  for (const item of response.output) {
    if (!isFunctionCall(item)) {
      continue;
    }

    // Parse the function-call arguments and record the call in context.
    const args = JSON.parse(item.arguments) as Record<string, unknown>;
    context.push({ type: "function_call", name: item.name, arguments: item.arguments, call_id: item.call_id });

    // The final_answer tool is the model's signal that work is complete.
    if (item.name === "final_answer") {
      finalAnswer = typeof args.answer === "string" ? args.answer : null;
      done = true;
      break;
    }

    // Execute regular tools and compact any success or error into a string output.
    const output = executeTool(item.name, args);
    // Add the tool result to context so the model can use it in the next step.
    context.push({ type: "function_call_output", call_id: item.call_id, output });
  }
}

// Handle max steps case.
if (!done) {
  console.log("Reached maximum steps.");
}

// Print the final answer if the loop completed.
console.log(finalAnswer);
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
```ts
// Status is explicit so callers can inspect where a run stopped.
export type AgentStatus = "running" | "complete" | "failed" | "max_steps_reached";

// State combines execution data and business data.
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

`src/core/tools/functions/math.ts`
```ts
// Tools are ordinary TypeScript functions.
// The agent will call them after the model returns structured arguments.
export function sumNumbers(args: Record<string, unknown>): number {
  return requireNumber(args.a, "a") + requireNumber(args.b, "b");
}

// Validate unknown JSON values before using them as numbers.
function requireNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}
```

`src/core/agent.ts`
```ts
export class Agent {
  async run(inputState: State): Promise<State> {
    // Keep run() non-mutating for callers by working on a deep copy.
    let state = structuredClone(inputState);
    // Ensure the reducer starts from a running lifecycle state.
    state.status = "running";

    // Reducer loop: state in, state out.
    // Continue until complete or max steps reached.
    while (state.status === "running" && state.steps < this.maxSteps) {
      // Each step processes function calls and updates state.
      state = await this.nextStep(state);
    }

    // Handle max steps case.
    if (state.status === "running") {
      state.status = "max_steps_reached";
    }

    // Return the final state.
    return state;
  }
}
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
- If your work is done, call the final_answer tool.
- If you need clarification from the user, call the ask_human tool.
- Always prefer calling tools to compute, fetch, or transform information rather than fabricating results.
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
```ts
export function serializeContextToText(context: ContextItem[]): string {
  // Extract the original user request from structured context.
  const userMessage = context.find((item) => "role" in item && item.role === "user")?.content ?? "";
  // Format completed tool calls and outputs into a readable execution history.
  const completed = buildCompletedActionLines(context);

  // Fill the owned markdown template with exactly the context we want the model to see.
  return template
    .replace("{user_message}", userMessage)
    .replace("{execution_history}", completed.length > 0 ? completed.join("\n") : "(No actions completed yet)");
}
```

### Unit 3 - Unifying Execution and Business States
#### Goal
Create a unified `State` object that includes steps, status, context, pending tool calls, errors, and final answer. Students learn Factor 5 by removing hidden runtime state from the agent.

#### Files
`src/core/models/state.ts`
```ts
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
```ts
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

    // final_answer completes the workflow and stores the answer in business state.
    if (functionCall.name === "final_answer") {
      state.pending_tool_calls = [];
      state.status = "complete";
      state.final_answer = typeof functionCall.arguments.answer === "string" ? functionCall.arguments.answer : null;
      return state;
    }

    // Execute the requested tool and compact success or failure into context.
    const output = executeTool(functionCall.name, functionCall.arguments);
    // Store tool output in the same state object.
    state.context.push({ type: "function_call_output", call_id: functionCall.call_id, output });
  }

  // Ask the model what tool call should happen next.
  const response = await this.callLlm(state);
  // Queue new tool calls inside the unified state for the next step.
  state.pending_tool_calls.push(...response.map(toPendingToolCall));
  return state;
}
```

---

# Course 4: Exposing Agents with Simple APIs in TypeScript

## Overview
Expose agents as services reachable from any interface. With Factors 5, 6, 7, and 11, students persist unified state, orchestrate runs through REST endpoints, add pause/resume controls, wire human responses back into waiting workflows, and decouple the agent from any one client.

## Outline
### Unit 1 - Launching Agents with RESTful APIs
#### Goal
Build a Node HTTP server with endpoints to launch agents and retrieve state. By decoupling agent logic from the interface and exposing it through REST, this unit implements Factor 11.

#### Files
`src/server/main.ts`
```ts
// Create the shared persistence layer and agent instance.
const store = new StateStore();
const agent = new Agent({ maxSteps: 10 });

// Launch endpoint: create a new state and start work in the background.
if (request.method === "POST" && url.pathname === "/agent/launch") {
  // Parse and validate the request body.
  const body = await readJsonBody(request);
  assertObject(body);
  const inputPrompt = requireStringField(body, "input_prompt");
  // Create initial state with a unique ID and the user's prompt.
  const initialState = createInitialState(randomUUID(), inputPrompt);

  // Store the state before background work starts so clients can poll immediately.
  store.save(initialState);
  // Run agent in background (non-blocking).
  void runAgentInBackground(initialState.id);

  // Return the initial state immediately.
  sendJson(response, 200, initialState);
}

// State endpoint: let any client retrieve current progress by ID.
if (request.method === "GET" && url.pathname.startsWith("/agent/state/")) {
  const state = store.get(stateId);
  sendJson(response, 200, state);
}
```

### Unit 2 - Persisting States with a Store and Callbacks
#### Goal
Replace in-memory storage with a file-backed state store and add progress callbacks to persist state after each agent step. This creates a course-friendly persistence layer while keeping the agent stateless.

#### Files
`src/server/database.ts`
```ts
export class StateStore {
  // Get the current state by ID from the backing store.
  get(id: string): State | null {
    return this.readAll().states[id] ?? null;
  }

  // Save a complete State snapshot.
  // The agent remains stateless because persistence lives outside the reducer.
  save(state: State): State {
    const all = this.readAll();
    all.states[state.id] = state;
    this.writeAll(all);
    return state;
  }
}
```

`src/server/main.ts`
```ts
// Run the agent with a progress callback.
// The callback persists state after each reducer step.
const finalState = await agent.run(initialState, async (state) => {
  // Read the latest persisted state in case another API call changed it.
  const persisted = store.get(stateId);

  // If the pause endpoint changed status to paused, stop the local run loop.
  if (persisted?.status === "paused") {
    state.status = "paused";
    // Don't overwrite the paused status; just save the latest execution fields.
    store.save({ ...state, status: "paused" });
    return;
  }

  // Normal progress save.
  // This allows clients to poll and see progress in real time.
  store.save(state);
});
```

### Unit 3 - Pausing and Resuming Agents Through API Calls
#### Goal
Add endpoints to pause running agents and resume paused or step-limited agents. Students learn Factor 6 by making lifecycle controls simple, explicit API operations.

#### Files
`src/server/main.ts`
```ts
// Pause endpoint: mark a running state as paused.
if (request.method === "POST" && url.pathname === "/agent/pause") {
  const id = requireStringField(body, "id");
  const updated = store.update(id, (state) => {
    // Only allow pausing if the agent is currently running.
    if (state.status !== "running") {
      throw new HttpError(400, `Cannot pause agent. Current status: ${state.status}`);
    }

    // The progress callback will observe this persisted status and stop the run.
    return { ...state, status: "paused" };
  });

  sendJson(response, 200, updated);
}

// Resume endpoint: restart background execution from saved state.
if (request.method === "POST" && url.pathname === "/agent/resume") {
  const current = store.get(id);
  // Clear previous errors and move the lifecycle back to running.
  const workingState = store.save({ ...current, status: "running", error: null });
  // Run agent in background (non-blocking).
  void runAgentInBackground(id, workingState);
  sendJson(response, 200, workingState);
}
```

### Unit 4 - Integrating Human Input Back to Agents
#### Goal
Create an API endpoint that accepts human input for waiting agents and resumes execution with the response. This completes Factor 7 by modeling human escalation as a tool call and response pair.

#### Files
`src/server/main.ts`
```ts
// Provide-input endpoint: continue a workflow paused on ask_human.
if (request.method === "POST" && url.pathname === "/agent/provide_input") {
  // Parse the state ID and the human's answer from the request.
  const id = requireStringField(body, "id");
  const answer = requireStringField(body, "answer");
  const current = store.get(id);

  // Only states waiting for human input can accept this endpoint.
  if (current.status !== "waiting_human_input") {
    throw new HttpError(400, `State is not waiting for human input. Current status: ${current.status}`);
  }

  // Find the call_id from the last ask_human call.
  // This matches the human's answer to the original tool call.
  const callId = getAskHumanCallId(current);
  // Add the human answer as a function_call_output in the context.
  const workingState: State = {
    ...current,
    status: "running",
    context: [
      ...current.context,
      {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify({ answer })
      }
    ]
  };

  // Save the updated context before resuming execution.
  store.save(workingState);
  // Run agent in background so the HTTP request can return immediately.
  void runAgentInBackground(id, workingState);
  sendJson(response, 200, workingState);
}
```

### Unit 5 - Controlling Agents from an Accessible Client
#### Goal
Demonstrate using API clients and a web UI to interact with the same agent service. Students see how CLI scripts and React screens can launch, monitor, pause, resume, and answer agent workflows without changing core agent logic.

#### Files
`src/client/main.ts`
```ts
// Create an API client pointed at the backend server.
const client = new Client("http://localhost:8000");
// Launch a new agent workflow from any interface, not just the web UI.
const launched = await client.launch("Solve the roots of this equation: x^2 - 5x + 6 = 0");
// Poll until the agent reaches a terminal status.
const finalState = await pollUntilComplete(client, launched.id);
// Display the final state for inspection and debugging.
console.log(JSON.stringify(finalState, null, 2));
```

`frontend/src/App.tsx`
```tsx
// Launch a new agent from the React UI.
const handleLaunch = async (prompt: string): Promise<void> => {
  // Call the same REST API the CLI client uses.
  const state = await agentApi.launch(prompt);
  // Add the new run to local history and select it.
  setAgents((previous) => [state, ...previous]);
  setSelectedAgent(state);
  // Poll the backend for progress updates.
  startPolling(state.id);
};

// Provide a human answer when the agent has called ask_human.
const handleProvideInput = async (answer: string): Promise<void> => {
  // Send the human's answer back to the backend.
  const state = await agentApi.provideInput(humanInputQuestion.agentId, answer);
  // Update local UI state and continue polling the resumed run.
  updateAgentState(state);
  startPolling(state.id);
};
```

#### Final Project Shape
```text
backend/
  src/core/agent.ts
  src/core/models/state.ts
  src/core/prompts/
  src/core/tools/
  src/core/utils/contextSerializer.ts
  src/server/main.ts
  src/server/database.ts
  src/client/main.ts
  tests/agent.test.ts

frontend/
  src/App.tsx
  src/api/client.ts
  src/components/
  src/types.ts
```

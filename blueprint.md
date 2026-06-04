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
Master the practical building blocks of agentic systems in TypeScript. Covering Factors 1, 3, 4, 8, and 9, this course teaches structured model outputs, typed tool schemas, explicit context management, and controlled loops that execute tools and compact errors back into context.

## Outline
### Unit 1 - Prompting LLMs for Structured Outputs
#### Goal
Teach how to prompt the Responses API to return structured JSON that can be parsed and processed. This grounds Factor 1 by having the model translate natural language into schema-shaped output.

#### Files
`main.ts`
```ts
const systemPrompt = `
You are a helpful assistant that only answers with this JSON schema:
{
  "answer": "the answer to the question"
}
`;

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-5",
    instructions: systemPrompt,
    input: [{ role: "user", content: "What is 15 + 27?" }],
    reasoning: { effort: "low" }
  })
});

const body = (await response.json()) as { output_text?: string };
const result = JSON.parse(body.output_text ?? "{}") as { answer?: string };
console.log(`Answer: ${result.answer}`);
```

### Unit 2 - Defining a Tool Schema and Requiring Tool Use
#### Goal
Write a tool schema, provide it to the model, and handle the tool-call output. Students reinforce Factor 4 by parsing a structured function call and requiring tool use with `tool_choice: "required"`.

#### Files
`main.ts`
```ts
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

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-5",
    instructions: "You are a helpful assistant.",
    input: [{ role: "user", content: "What is 15 + 27?" }],
    tools: toolSchemas,
    tool_choice: "required",
    reasoning: { effort: "low" }
  })
});

const body = (await response.json()) as { output?: unknown[] };
const call = body.output?.find(isFunctionCall);
if (call?.name === "final_answer") {
  const args = JSON.parse(call.arguments) as { answer: string };
  console.log(`Answer: ${args.answer}`);
}

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

const context: ContextItem[] = [
  { role: "user", content: "Compute 15 + 27 and 8 * 11" }
];

// First model response asks for tools.
for (const item of response.output.filter(isFunctionCall)) {
  context.push({
    type: "function_call",
    name: item.name,
    arguments: item.arguments,
    call_id: item.call_id
  });

  const args = JSON.parse(item.arguments) as { a: number; b: number };
  const result = item.name === "add" ? add(args.a, args.b) : multiply(args.a, args.b);

  context.push({
    type: "function_call_output",
    call_id: item.call_id,
    output: JSON.stringify({ result })
  });
}

// The next model request receives the updated context.
```

### Unit 4 - Controlling Loops of Agentic Tool-Use
#### Goal
Build an agentic loop that repeatedly calls the model, executes tools, and updates context until completion or a step limit. This implements Factor 8 through explicit loop management and Factor 9 by returning execution failures as compact tool outputs.

#### Files
`main.ts`
```ts
let step = 0;
let done = false;
let finalAnswer: string | null = null;

while (!done && step < 10) {
  step += 1;
  const response = await callModel(context);

  for (const item of response.output) {
    if (!isFunctionCall(item)) {
      continue;
    }

    const args = JSON.parse(item.arguments) as Record<string, unknown>;
    context.push({ type: "function_call", name: item.name, arguments: item.arguments, call_id: item.call_id });

    if (item.name === "final_answer") {
      finalAnswer = typeof args.answer === "string" ? args.answer : null;
      done = true;
      break;
    }

    const output = executeTool(item.name, args);
    context.push({ type: "function_call_output", call_id: item.call_id, output });
  }
}

if (!done) {
  console.log("Reached maximum steps.");
}

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
export type AgentStatus = "running" | "complete" | "failed" | "max_steps_reached";

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
export function sumNumbers(args: Record<string, unknown>): number {
  return requireNumber(args.a, "a") + requireNumber(args.b, "b");
}

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
  const userMessage = context.find((item) => "role" in item && item.role === "user")?.content ?? "";
  const completed = buildCompletedActionLines(context);

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
export interface PendingToolCall {
  type: "function_call";
  name: string;
  arguments: Record<string, unknown>;
  call_id: string;
}

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
  state.steps += 1;

  for (const functionCall of [...state.pending_tool_calls]) {
    state.context.push({
      type: "function_call",
      name: functionCall.name,
      arguments: JSON.stringify(functionCall.arguments),
      call_id: functionCall.call_id
    });

    if (functionCall.name === "final_answer") {
      state.pending_tool_calls = [];
      state.status = "complete";
      state.final_answer = typeof functionCall.arguments.answer === "string" ? functionCall.arguments.answer : null;
      return state;
    }

    const output = executeTool(functionCall.name, functionCall.arguments);
    state.context.push({ type: "function_call_output", call_id: functionCall.call_id, output });
  }

  const response = await this.callLlm(state);
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
const store = new StateStore();
const agent = new Agent({ maxSteps: 10 });

if (request.method === "POST" && url.pathname === "/agent/launch") {
  const body = await readJsonBody(request);
  assertObject(body);
  const inputPrompt = requireStringField(body, "input_prompt");
  const initialState = createInitialState(randomUUID(), inputPrompt);

  store.save(initialState);
  void runAgentInBackground(initialState.id);

  sendJson(response, 200, initialState);
}

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
  get(id: string): State | null {
    return this.readAll().states[id] ?? null;
  }

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
const finalState = await agent.run(initialState, async (state) => {
  const persisted = store.get(stateId);

  if (persisted?.status === "paused") {
    state.status = "paused";
    store.save({ ...state, status: "paused" });
    return;
  }

  store.save(state);
});
```

### Unit 3 - Pausing and Resuming Agents Through API Calls
#### Goal
Add endpoints to pause running agents and resume paused or step-limited agents. Students learn Factor 6 by making lifecycle controls simple, explicit API operations.

#### Files
`src/server/main.ts`
```ts
if (request.method === "POST" && url.pathname === "/agent/pause") {
  const id = requireStringField(body, "id");
  const updated = store.update(id, (state) => {
    if (state.status !== "running") {
      throw new HttpError(400, `Cannot pause agent. Current status: ${state.status}`);
    }

    return { ...state, status: "paused" };
  });

  sendJson(response, 200, updated);
}

if (request.method === "POST" && url.pathname === "/agent/resume") {
  const current = store.get(id);
  const workingState = store.save({ ...current, status: "running", error: null });
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
if (request.method === "POST" && url.pathname === "/agent/provide_input") {
  const id = requireStringField(body, "id");
  const answer = requireStringField(body, "answer");
  const current = store.get(id);

  if (current.status !== "waiting_human_input") {
    throw new HttpError(400, `State is not waiting for human input. Current status: ${current.status}`);
  }

  const callId = getAskHumanCallId(current);
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

  store.save(workingState);
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
const client = new Client("http://localhost:8000");
const launched = await client.launch("Solve the roots of this equation: x^2 - 5x + 6 = 0");
const finalState = await pollUntilComplete(client, launched.id);
console.log(JSON.stringify(finalState, null, 2));
```

`frontend/src/App.tsx`
```tsx
const handleLaunch = async (prompt: string): Promise<void> => {
  const state = await agentApi.launch(prompt);
  setAgents((previous) => [state, ...previous]);
  setSelectedAgent(state);
  startPolling(state.id);
};

const handleProvideInput = async (answer: string): Promise<void> => {
  const state = await agentApi.provideInput(humanInputQuestion.agentId, answer);
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

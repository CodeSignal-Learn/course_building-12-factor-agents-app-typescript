# Building a 12-Factor Agents App in TypeScript

This project is a TypeScript learning app that demonstrates how to build reliable LLM-powered systems with the 12-Factor Agents methodology.

The application includes:

- A strict TypeScript backend with an explicit agent reducer and the official OpenAI SDK.
- Versioned prompt and tool schema assets.
- File-backed state persistence for launch, pause, resume, and human input workflows.
- A React TypeScript frontend for launching and monitoring agent runs.
- Focused tests for the deterministic parts of the agent.

## Requirements

- Node.js 20+
- npm
- OpenAI API key

## Quick Start

```bash
export OPENAI_API_KEY="your-api-key-here"
npm install
./start.sh
```

The startup script launches:

- Backend API: `http://localhost:8000`
- Frontend UI: `http://localhost:3000`

## Manual Commands

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
npm test
npm run build
```

## Project Structure

```text
backend/
  src/core/        Agent, state model, prompts, tools, context serializer
  src/server/      REST API and state persistence
  src/client/      Example polling client
  tests/           Backend tests

frontend/
  src/             React TypeScript UI and API client
```

## 12-Factor Agent Ideas Demonstrated

1. Natural language requests become structured tool calls.
2. Prompts are project-owned markdown files.
3. Context is serialized explicitly.
4. Tools are plain structured outputs.
5. Execution state and business state live in one state object.
6. Agents can launch, pause, and resume through simple APIs.
7. Human input is modeled as a tool call.
8. The application owns the control loop.
9. Tool errors are compacted back into context.
10. Tools and modules stay small and focused.
11. The same agent can be triggered from CLI, API, or UI.
12. The agent is a stateless reducer: state in, state out.

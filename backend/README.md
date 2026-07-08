# 12-Factor Agents Backend

Strict TypeScript backend for the 12-Factor Agents course app.

## Run

```bash
npm install
npm run dev --workspace backend
```

The server listens on `http://localhost:3000`. It also serves the built frontend from `frontend/dist` when present, so the UI and the API share one port.

## Environment

```bash
export OPENAI_API_KEY="your-api-key-here"
```

Optional variables:

- `PORT`: server port, default `3000`
- `HOST`: backend host, default `0.0.0.0`
- `OPENAI_BASE_URL`: alternate OpenAI-compatible base URL

## API

### Launch

```http
POST /agent/launch
Content-Type: application/json

{ "input_prompt": "What is 15 + 27?" }
```

### Get State

```http
GET /agent/state/{id}
```

### Pause

```http
POST /agent/pause
Content-Type: application/json

{ "id": "state-id" }
```

### Resume

```http
POST /agent/resume
Content-Type: application/json

{ "id": "state-id" }
```

### Provide Human Input

```http
POST /agent/provide_input
Content-Type: application/json

{ "id": "state-id", "answer": "Human response" }
```

## Architecture

The backend keeps the agent core independent from HTTP. The server loads and saves `State` objects, while `Agent.run()` receives a state and returns a new state. A progress callback persists state after each step so clients can poll live progress.

Runtime state is stored in `backend/data/agent_states.db`, which is created automatically.

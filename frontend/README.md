# 12-Factor Agents Frontend

React TypeScript client for launching, monitoring, pausing, resuming, and answering human-input requests from the agent API.

## Run

```bash
npm install
npm run dev --workspace frontend
```

In production the UI is served by the combined server at `http://localhost:3000` (build with `npm run build --workspace frontend`; the backend serves `frontend/dist`). The Vite dev server proxies `/agent` requests to the combined server, so run the backend alongside it.

To point the UI at a different API origin:

```bash
VITE_API_BASE_URL=http://localhost:3000 npm run dev --workspace frontend
```

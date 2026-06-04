# 12-Factor Agents Frontend

React TypeScript client for launching, monitoring, pausing, resuming, and answering human-input requests from the agent API.

## Run

```bash
npm install
npm run dev --workspace frontend
```

The UI runs on `http://localhost:3000` and expects the backend at `http://localhost:8000`.

To override the API URL:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev --workspace frontend
```

#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Shutting down servers...${NC}"
  kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
  wait "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
  echo -e "${GREEN}Servers stopped.${NC}"
}

trap cleanup SIGINT SIGTERM EXIT

if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
  echo -e "${RED}Error: run this script from the project root.${NC}"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}Error: node is not installed.${NC}"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}Error: npm is not installed.${NC}"
  exit 1
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo -e "${YELLOW}Warning: OPENAI_API_KEY is not set. The backend will fail when it calls the model.${NC}"
fi

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing workspace dependencies...${NC}"
  npm install
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  12-Factor Agents TypeScript App${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "${GREEN}Building backend...${NC}"
npm run build --workspace backend > backend.log 2>&1

echo -e "${GREEN}Starting backend on http://localhost:8000${NC}"
node backend/dist/server/main.js >> backend.log 2>&1 &
BACKEND_PID=$!

sleep 2
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo -e "${RED}Backend failed to start. See backend.log.${NC}"
  exit 1
fi

echo -e "${GREEN}Starting frontend on http://localhost:3000${NC}"
npm run dev --workspace frontend -- --host 0.0.0.0 > frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 2
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo -e "${RED}Frontend failed to start. See frontend.log.${NC}"
  exit 1
fi

echo -e "${GREEN}Servers are running.${NC}"
echo -e "Backend API: ${GREEN}http://localhost:8000${NC}"
echo -e "Frontend UI: ${GREEN}http://localhost:3000${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both servers.${NC}"

wait "$BACKEND_PID" "$FRONTEND_PID"

#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cleanup() {
  echo -e "\n${YELLOW}Shutting down server...${NC}"
  kill "${SERVER_PID:-}" 2>/dev/null || true
  wait "${SERVER_PID:-}" 2>/dev/null || true
  echo -e "${GREEN}Server stopped.${NC}"
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
npm run build --workspace backend > server.log 2>&1

echo -e "${GREEN}Building frontend...${NC}"
npm run build --workspace frontend >> server.log 2>&1

echo -e "${GREEN}Starting combined server on http://localhost:3000${NC}"
node backend/dist/server/main.js >> server.log 2>&1 &
SERVER_PID=$!

sleep 2
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo -e "${RED}Server failed to start. See server.log.${NC}"
  exit 1
fi

echo -e "${GREEN}Server is running.${NC}"
echo -e "Frontend UI and backend API: ${GREEN}http://localhost:3000${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server.${NC}"

wait "$SERVER_PID"

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

// Combined server: the API and the built frontend are served from one port.
// The frontend build lives at <repo>/frontend/dist, three levels up from here.
const frontendDist = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "frontend", "dist");

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // Any GET that no API route or static file handled loads the SPA entry point
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/agent")) {
      next();
      return;
    }

    response.sendFile(join(frontendDist, "index.html"));
  });
} else {
  console.warn(`Frontend build not found at ${frontendDist} — serving the API only.`);
}

app.listen(port, host, () => {
  console.log(`Combined server (API + frontend) listening on http://${host}:${port}`);
});

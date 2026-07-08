import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // The combined server owns port 3000, so the dev server sits next to it
    // and forwards API calls to keep the UI on a same-origin setup
    port: 3001,
    proxy: {
      "/agent": "http://localhost:3000"
    }
  }
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development, /api goes to `wrangler pages dev` (Cloudflare Functions on port 8788).
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:8788" } },
});

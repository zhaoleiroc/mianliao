import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pick the base URL for emitted <script>/<link href> tags.
//
//   BASE_URL=/some/path/        → explicit override (highest priority).
//                                  Use this on GitHub Actions where the
//                                  path is "/mianliao/".
//   DEPLOY_CLOUDFLARE=1          → root ("/"). The site is served at
//                                  <project>.pages.dev, no prefix needed.
//   nothing set, production      → "/mianliao/"  (GitHub Pages project
//                                  page is the canonical default).
//   nothing set, dev / preview   → "/"           (local server works at
//                                  root).
const env = process.env;
const explicitBase = env.BASE_URL && env.BASE_URL.length > 0 ? env.BASE_URL : null;
const inferredBase =
  env.DEPLOY_CLOUDFLARE === "1"
    ? "/"
    : env.NODE_ENV === "production"
      ? "/mianliao/"
      : "/";
const BASE = explicitBase ?? inferredBase;

export default defineConfig({
  plugins: [react()],
  base: BASE,
  publicDir: "assets",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: false,
    // Dev convenience: proxy the local API through Vite so the frontend
    // can call `/api/*` (relative) and we don't need VITE_API_BASE for dev.
    // Vite proxy matches paths before the static handler, so /api/health
    // goes to http://localhost:5001/api/health and everything else falls
    // through to the SPA.
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: false,
      },
      // Archive images live on the API at /uploads/archive/* (served by
      // server/src/index.ts's express.static). Mirror that mount path
      // through Vite so relative URLs like /uploads/archive/.../xxx.png
      // resolve in dev.
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: false,
      },
    },
  },
  preview: {
    port: 4173,
  },
});

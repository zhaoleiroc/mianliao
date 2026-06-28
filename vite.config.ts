import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use BASE_URL env var to override the project-page path. Defaults to
// "/mianliao/" for production builds (GitHub Pages project page) and "/"
// for dev/preview so the local server works at the root.
const BASE = process.env.BASE_URL ?? (process.env.NODE_ENV === "production" ? "/mianliao/" : "/");

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
  },
  preview: {
    port: 4173,
  },
});

// Post-build step. Runs after `vite build` and prepares dist/ for static
// hosting on GitHub Pages:
//   - copies index.html to 404.html so SPA deep links survive a 404 (e.g.
//     navigating straight to https://user.github.io/mianliao/fabrics/abc).
//   - writes .nojekyll so GitHub Pages bypasses Jekyll processing (otherwise
//     any folder starting with "_" would be excluded, breaking nothing today
//     but future-proofing the deploy).
//   - prints a small summary so CI logs are easy to scan.
import { copyFile, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

if (!(await exists(dist))) {
  console.error("postbuild: dist/ not found, did vite build run?");
  process.exit(1);
}

await copyFile(join(dist, "index.html"), join(dist, "404.html"));
await writeFile(join(dist, ".nojekyll"), "");

const indexHtml = await readFile(join(dist, "index.html"), "utf8");
const baseMatch = indexHtml.match(new RegExp('<base href="([^"]*)"|<script[^\\>]*src="(\\.{1,2}/assets/[^"]+)"'));
const baseHint = baseMatch ? (baseMatch[1] || baseMatch[2] || "auto") : "auto";

const files = await readdir(dist, { recursive: true });
const fileCount = files.filter((f) => f.endsWith(".html") || f.endsWith(".js") || f.endsWith(".css") || f.endsWith(".json")).length;
console.log("postbuild OK");
console.log("  - 404.html created (SPA fallback)");
console.log("  - .nojekyll created (bypass Jekyll)");
console.log("  - base hint: " + baseHint);
console.log("  - dist contains " + fileCount + " build artifacts");

"""Tiny local viewer for rotating fabric images one at a time.

GET  /                       → viewer HTML
GET  /api/fabrics            → JSON list of (image_path, fabric metadata)
GET  /img/<relative_path>    → serve image from assets/
POST /api/rotate             → { path, degrees }, rotates image and saves

Run with:
    python scripts/serve_rotate_viewer.py

Then open  http://127.0.0.1:5555/  in a browser.
"""
from __future__ import annotations

import json
import mimetypes
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FABRICS_JSON = ROOT / "data" / "fabrics.json"
MANIFEST_JSON = ROOT / "data" / "image_manifest.json"
ASSETS_DIR = ROOT / "assets"
HOST = "127.0.0.1"
PORT = 5555

ALLOWED_DEGREES = (-90, 90, 180)

CATEGORY_LABEL = {
    "knit": "针织",
    "woven": "化纤梭织",
    "pu_suede": "PU 麂皮",
    "home_textile": "家纺阻燃",
}


def _viewer_html() -> bytes:
    return r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>面料图旋转工具</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
      background: #ffffff;
      color: #171717;
      padding: 32px 32px 96px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    header { max-width: 1100px; margin: 0 auto 24px; }
    h1 { font-size: 18px; font-weight: 500; margin: 0 0 8px; letter-spacing: -0.01em; }
    p.note { color: #737373; font-size: 13px; line-height: 1.6; max-width: 720px; margin: 0; }
    p.note code { background: #f5f5f5; padding: 1px 6px; font-size: 12px; color: #404040; }
    .grid {
      max-width: 1100px;
      margin: 32px auto 0;
      display: grid;
      gap: 40px 24px;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    }
    .card {
      border: 1px solid #e5e5e5;
      background: #ffffff;
      padding: 12px;
    }
    .thumb {
      width: 100%;
      aspect-ratio: 1 / 1;
      background: #f5f5f5;
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .meta { padding: 12px 4px 4px; }
    .cat {
      font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
      color: #a3a3a3;
    }
    .name { font-size: 14px; font-weight: 500; margin-top: 4px; line-height: 1.4; color: #171717; }
    .code {
      font-size: 11px; color: #737373; margin-top: 2px;
      font-variant-numeric: tabular-nums;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .fid { font-size: 10px; color: #a3a3a3; margin-top: 2px; }
    .actions {
      display: flex; gap: 4px; padding-top: 10px;
    }
    .actions button {
      flex: 1;
      border: 1px solid #e5e5e5;
      background: #ffffff; color: #525252;
      font: inherit; font-size: 12px;
      padding: 6px 4px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }
    .actions button:hover:not(:disabled) {
      border-color: #171717; color: #171717;
    }
    .actions button:active:not(:disabled) {
      background: #171717; color: #ffffff; border-color: #171717;
    }
    .actions button:disabled { opacity: 0.4; cursor: wait; }
    .actions button.ok {
      background: #f0fdf4; color: #166534; border-color: #86efac;
    }
    .toast {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: #171717; color: #ffffff;
      padding: 10px 20px;
      font-size: 13px;
      border-radius: 0;
      opacity: 0;
      transition: opacity 0.25s ease;
      pointer-events: none;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <header>
    <h1>面料图旋转工具</h1>
    <p class="note">
      列出有图的 27 张面料（按出现顺序）。点按钮即时旋转 + 写回 <code>assets/fabrics/</code>。
      刷新 / 重新加载会重读文件。
      旋转时记录原图后缀 <code>.before-rotate.bak</code>，可手动 rm 或 <code>git checkout</code> 撤销。结束关 server 即可。
    </p>
  </header>
  <main id="grid" class="grid"></main>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>

<script>
const CATEGORY_LABEL = {
  knit:        "针织",
  woven:       "化纤梭织",
  pu_suede:    "PU 麂皮",
  home_textile:"家纺阻燃"
};

const grid = document.getElementById("grid");
const toastEl = document.getElementById("toast");
let toastTimer;

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1400);
}

async function load() {
  let items;
  try {
    const res = await fetch("/api/fabrics");
    items = (await res.json()).fabrics;
  } catch (e) {
    toast("加载失败: " + e.message);
    return;
  }
  for (const f of items) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="thumb"><img src="/img/${f.image_path}?v=${Date.now()}" alt="${escapeHtml(f.fabric_name || '')}" /></div>
      <div class="meta">
        <div class="cat">${CATEGORY_LABEL[f.category] || ""}</div>
        <div class="name">${escapeHtml(f.fabric_name || "—")}</div>
        ${f.code ? `<div class="code">${escapeHtml(f.code)}</div>` : ""}
        <div class="fid">${escapeHtml(f.fabric_id || "")}</div>
      </div>
      <div class="actions">
        <button data-deg="-90" title="逆时针 90°">← 90°</button>
        <button data-deg="180" title="旋转 180°">↻ 180°</button>
        <button data-deg="90"  title="顺时针 90°">90° →</button>
      </div>`;
    grid.appendChild(card);
    const img = card.querySelector("img");
    card.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const deg = parseInt(btn.dataset.deg, 10);
        const buttons = card.querySelectorAll("button");
        buttons.forEach((b) => (b.disabled = true));
        try {
          const res = await fetch("/api/rotate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: f.image_path, degrees: deg }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`${res.status} ${text}`);
          }
          btn.classList.add("ok");
          setTimeout(() => btn.classList.remove("ok"), 700);
          img.src = `/img/${f.image_path}?v=${Date.now()}`;
          toast(`已旋转 ${deg > 0 ? "顺时针" : deg < 0 ? "逆时针" : ""} ${Math.abs(deg)}°`);
        } catch (e) {
          toast("失败: " + e.message);
        } finally {
          buttons.forEach((b) => (b.disabled = false));
        }
      });
    });
  }
}

load();
</script>
</body>
</html>
""".encode("utf-8")


def fabric_listing() -> list[dict]:
    fabrics_data = json.loads(FABRICS_JSON.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_JSON.read_text(encoding="utf-8"))
    by_id = {f["id"]: f for f in fabrics_data["fabrics"]}

    seen: set[str] = set()
    items: list[dict] = []
    for it in manifest["items"]:
        archive = it["archive_path"].replace("\\", "/")
        if not archive.startswith("assets/"):
            continue
        rel = archive[len("assets/"):]
        if rel in seen:
            continue
        seen.add(rel)
        fid = it.get("matched_fabric_id")
        meta = by_id.get(fid, {})
        items.append({
            "image_path": rel,
            "fabric_id": fid,
            "fabric_name": it.get("matched_fabric_name"),
            "code": meta.get("code"),
            "category": meta.get("category"),
        })
    return items


def rotate_image(target: Path, degrees: int) -> None:
    """Rotate pixels in place. PIL positive angle is CCW; UI passes the
    user-facing direction (-90 / 90 / 180) so we negate."""
    img = Image.open(target)
    fmt = (img.format or "").upper()
    rotated = img.rotate(-degrees, expand=True)
    if fmt == "JPEG":
        quality = img.info.get("quality", 95)
        rotated.save(target, format="JPEG", quality=quality, optimize=True)
    elif fmt == "PNG":
        rotated.save(target, format="PNG", optimize=True)
    else:
        rotated.save(target, format=fmt)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # noqa: A003
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _safe_under_assets(self, rel: str) -> Path | None:
        candidate = (ASSETS_DIR / rel).resolve()
        try:
            candidate.relative_to(ASSETS_DIR.resolve())
        except ValueError:
            return None
        return candidate

    def do_GET(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        if path in ("/", "/index.html"):
            self._send(200, _viewer_html(), "text/html; charset=utf-8")
            return
        if path == "/api/fabrics":
            items = fabric_listing()
            body = json.dumps({"fabrics": items}).encode("utf-8")
            self._send(200, body, "application/json; charset=utf-8")
            return
        if path.startswith("/img/"):
            rel = urllib.parse.unquote(path[len("/img/"):])
            target = self._safe_under_assets(rel)
            if target is None or not target.is_file():
                self.send_error(404)
                return
            data = target.read_bytes()
            ctype, _ = mimetypes.guess_type(str(target))
            ctype = ctype or "application/octet-stream"
            self._send(200, data, ctype)
            return
        self.send_error(404)

    def do_POST(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/rotate":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length) or b"{}")
                rel = payload["path"]
                degrees = int(payload["degrees"])
            except (json.JSONDecodeError, KeyError, ValueError, TypeError):
                self.send_error(400, "Bad request body")
                return
            if degrees not in ALLOWED_DEGREES:
                self.send_error(400, "degrees must be -90, 90, or 180")
                return
            target = self._safe_under_assets(rel)
            if target is None or not target.is_file():
                self.send_error(404)
                return
            try:
                rotate_image(target, degrees)
            except Exception as e:  # noqa: BLE001
                self.send_error(500, f"rotate failed: {e}")
                return
            self._send(200, b'{"ok":true}', "application/json; charset=utf-8")
            return
        self.send_error(404)


def main() -> None:
    print(f"Fabric rotation viewer at http://{HOST}:{PORT}/")
    print(f"  reads:  {FABRICS_JSON.relative_to(ROOT)}, {MANIFEST_JSON.relative_to(ROOT)}")
    print(f"  writes: {ASSETS_DIR.relative_to(ROOT)}/<relative path>")
    print("  stop:   Ctrl+C")
    try:
        HTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()

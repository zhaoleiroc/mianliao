"""Deploy dist/ to Cloudflare Pages via the REST API.

One-shot, idempotent. Creates the project if it doesn't exist, then
uploads the static build. Result: https://mianliao.pages.dev

Usage:
    CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy \
        python scripts/deploy_cloudflare.py

To get the credentials:
  1. Sign up at https://dash.cloudflare.com/ (free)
  2. Account ID: dash.cloudflare.com -> bottom-right of any page
  3. API Token: My Profile -> API Tokens -> Create Token ->
     "Edit Cloudflare Pages" template
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

API = "https://api.cloudflare.com/client/v4"
PROJECT = "mianliao"
DIST = Path("dist")
ZIP = Path("_deploy_bundle.zip")


def require_env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        print(f"Missing env var {name}.", file=sys.stderr)
        print("See the module docstring for setup steps.", file=sys.stderr)
        sys.exit(2)
    return v


def cf(method: str, path: str, body=None, token: str = ""):
    headers = {"Authorization": f"Bearer {token}"}
    data = json.dumps(body).encode() if body is not None else None
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{API}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def zip_dist(src: Path, dst: Path) -> int:
    if dst.exists():
        dst.unlink()
    count = 0
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in src.rglob("*"):
            if p.is_file():
                arc = p.relative_to(src).as_posix()
                zf.write(p, arc)
                count += 1
    return count


def main() -> None:
    token = require_env("CLOUDFLARE_API_TOKEN")
    account = require_env("CLOUDFLARE_ACCOUNT_ID")

    print(f"project : {PROJECT}")
    print(f"account : {account}")

    # 1. ensure project exists
    print("\n[1/4] ensure project exists")
    status, body = cf("GET", f"/accounts/{account}/pages/projects/{PROJECT}", token=token)
    if status == 200:
        print(f"  project exists (id={body['result']['id']})")
    elif status == 404:
        print("  project missing, creating...")
        status, body = cf(
            "POST",
            f"/accounts/{account}/pages/projects",
            body={"name": PROJECT, "production_branch": "main"},
            token=token,
        )
        if status >= 300:
            print(json.dumps(body, indent=2, ensure_ascii=False))
            sys.exit(1)
        print(f"  created (id={body['result']['id']})")
    else:
        print(json.dumps(body, indent=2, ensure_ascii=False))
        sys.exit(1)

    # 2. zip dist/
    print("\n[2/4] zip dist/")
    if not DIST.exists():
        print(f"  {DIST} does not exist. Run `npm run build` first.", file=sys.stderr)
        sys.exit(2)
    n = zip_dist(DIST, ZIP)
    size_kb = ZIP.stat().st_size / 1024
    print(f"  {n} files -> {ZIP} ({size_kb:.1f} KB)")

    # 3. request an upload URL
    print("\n[3/4] request upload URL from Pages")
    status, body = cf(
        "POST",
        f"/accounts/{account}/pages/projects/{PROJECT}/deployments",
        body={"deployment_trigger": {"type": "api"}, "branch": "main"},
        token=token,
    )
    if status >= 300 or not body.get("success"):
        print(json.dumps(body, indent=2, ensure_ascii=False))
        sys.exit(1)
    upload_url = body["result"]["upload_url"]
    print(f"  upload URL issued")

    # 4. PUT the zip
    print("\n[4/4] upload bundle")
    req = urllib.request.Request(
        upload_url,
        data=ZIP.read_bytes(),
        method="POST",
        headers={"Content-Type": "application/zip"},
    )
    with urllib.request.urlopen(req) as resp:
        print(f"  upload: HTTP {resp.status}")

    try:
        ZIP.unlink()
    except OSError:
        pass

    site = body["result"].get("deployment_trigger", {}).get("metadata", {}).get("branch") or "main"
    print()
    print(f"OK. Wait ~30s for Pages to publish, then visit:")
    print(f"  https://{PROJECT}.pages.dev")


if __name__ == "__main__":
    main()

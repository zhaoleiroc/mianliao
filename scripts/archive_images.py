# -*- coding: utf-8 -*-
"""Catalog and (optionally) copy fabric images into a stable archive layout.

The source images live under 面料推荐档案/{面料推荐,家纺}/. They are renamed
into assets/fabrics/<category>/<supplier_slug>/ so the static site can
reference them deterministically.

The script is idempotent: running it twice produces the same result. It
NEVER moves or deletes source files unless --apply is passed.

Run:
    python scripts/archive_images.py            # generate manifest only
    python scripts/archive_images.py --apply    # also copy into assets/
    python scripts/archive_images.py --apply --force  # overwrite existing copies
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# UTF-8 stdout so non-breaking spaces in filenames print correctly on Windows
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "面料推荐档案"
ASSETS_DIR = ROOT / "assets" / "fabrics"
MANIFEST_PATH = ROOT / "data" / "image_manifest.json"


# ---------------------------------------------------------------------------
# Heuristic routing rules
# ---------------------------------------------------------------------------
@dataclass
class Route:
    """Rule for assigning an image to a category/supplier based on directory + extension."""
    category: str
    supplier_slug: str
    description: str
    confidence: str  # "high" | "medium" | "low"


ROUTES: list[Route] = [
    Route("knit", "huarui",   "面料推荐/ 下的 PNG 大图（与华瑞汇总表同目录）",         "medium"),
    Route("home_textile", "home_fr", "家纺/ 下的 JPG（与 260407 收到面料 同目录）",     "high"),
]

DEFAULT_ROUTE = Route("knit", "huarui", "默认兜底", "low")


def slugify(name: str) -> str:
    """Make a filesystem-safe slug."""
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in (" ", "_", "-"):
            out.append("-")
    s = "".join(out)
    while "--" in s:
        s = s.replace("--", "-")
    return s.strip("-") or "item"


def route_for(source_path: Path) -> Route:
    rel = source_path.relative_to(SOURCE_DIR).as_posix()
    ext = source_path.suffix.lower()
    if rel.startswith("面料推荐/"):
        return ROUTES[0]  # huarui (medium confidence)
    if rel.startswith("家纺/") and ext in (".jpg", ".jpeg"):
        return ROUTES[1]  # home_fr (high confidence)
    return DEFAULT_ROUTE


def short_hash(path: Path) -> str:
    h = hashlib.sha1()
    h.update(path.read_bytes())
    return h.hexdigest()[:8]


# ---------------------------------------------------------------------------
# Pairing images with fabric ids (best-effort heuristics)
# ---------------------------------------------------------------------------
def match_fabrics(images: list[dict], fabrics: list[dict]) -> None:
    """Annotate each image dict in place with a best-effort fabric_id match."""
    by_seq: dict[tuple[str, int], dict] = {}
    for f in fabrics:
        seq = None
        if f.get("code") and str(f["code"]).isdigit():
            seq = int(f["code"])
            by_seq[(f["category"], seq)] = f
    for img in images:
        if img["category_hint"] == "home_textile":
            # Sequence in the 9 JPG names is opaque; pair by alphabetical sort.
            order = sorted(
                [i for i in images if i["category_hint"] == "home_textile"],
                key=lambda x: x["original_filename"],
            )
            for idx, it in enumerate(order, start=1):
                if it["original_filename"] == img["original_filename"]:
                    target = by_seq.get(("home_textile", idx))
                    if target:
                        img["matched_fabric_id"] = target["id"]
                        img["matched_fabric_name"] = target["name"]
                    break
        else:
            img["matched_fabric_id"] = None
            img["matched_fabric_name"] = None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def collect_images() -> list[Path]:
    paths: list[Path] = []
    for ext in ("*.png", "*.jpg", "*.jpeg", "*.webp"):
        paths.extend(SOURCE_DIR.rglob(ext))
    return sorted(paths)


def build_manifest(apply: bool, force: bool) -> dict:
    fabrics_path = ROOT / "data" / "fabrics.json"
    fabrics = json.loads(fabrics_path.read_text(encoding="utf-8"))["fabrics"] if fabrics_path.exists() else []

    images_meta: list[dict] = []
    for src in collect_images():
        route = route_for(src)
        stem = slugify(src.stem)
        ext = src.suffix.lower()
        archive_rel = f"{route.category}/{route.supplier_slug}/{stem}{ext}"
        archive_path = ASSETS_DIR / route.category / route.supplier_slug / f"{stem}{ext}"
        images_meta.append({
            "original_path": str(src.relative_to(ROOT)),
            "original_filename": src.name,
            "archive_path": str(archive_path.relative_to(ROOT)),
            "category_hint": route.category,
            "supplier_hint": route.supplier_slug,
            "match_reason": route.description,
            "match_confidence": route.confidence,
            "size_bytes": src.stat().st_size,
            "sha1_8": short_hash(src),
            "needs_review": route.confidence != "high",
            "matched_fabric_id": None,
            "matched_fabric_name": None,
        })

    match_fabrics(images_meta, fabrics)

    # Resolve matched_fabric_id by re-running match_fabrics would overwrite;
    # match_fabrics already set it.

    counts = {
        "total": len(images_meta),
        "by_category": {},
        "needs_review": sum(1 for i in images_meta if i["needs_review"]),
    }
    for i in images_meta:
        counts["by_category"][i["category_hint"]] = counts["by_category"].get(i["category_hint"], 0) + 1

    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "schema_version": 1,
        "archive_root": str(ASSETS_DIR.relative_to(ROOT)),
        "apply_mode": apply,
        "counts": counts,
        "items": images_meta,
    }

    if apply:
        for i in images_meta:
            src = ROOT / i["original_path"]
            dst = ROOT / i["archive_path"]
            dst.parent.mkdir(parents=True, exist_ok=True)
            if dst.exists() and not force:
                i["copy_status"] = "skipped (exists)"
                continue
            shutil.copy2(src, dst)
            i["copy_status"] = "copied"
    else:
        for i in images_meta:
            i["copy_status"] = "plan (not copied)"

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest


def print_summary(manifest: dict) -> None:
    print(f"  total images:   {manifest['counts']['total']}")
    for cat, n in manifest['counts']['by_category'].items():
        print(f"  {cat:<14} {n}")
    print(f"  needs review:   {manifest['counts']['needs_review']}")
    print(f"  apply mode:     {manifest['apply_mode']}")
    print(f"  manifest:       {MANIFEST_PATH.relative_to(ROOT)}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Catalog and copy fabric images into assets/fabrics/.")
    ap.add_argument("--apply", action="store_true", help="Actually copy files into the archive.")
    ap.add_argument("--force", action="store_true", help="Overwrite existing archive copies.")
    args = ap.parse_args()
    manifest = build_manifest(apply=args.apply, force=args.force)
    print_summary(manifest)
    return 0


if __name__ == "__main__":
    sys.exit(main())

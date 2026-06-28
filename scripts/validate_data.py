# -*- coding: utf-8 -*-
"""Validate the generated data/*.json files.

Catches:
  - Missing required fields per record
  - Invalid category enum values
  - Duplicate fabric / supplier IDs
  - Mismatched counts (total vs len, per-source vs category)
  - 3S-AVVA fabrics with wrong number of supplier quotes
  - Image manifest references that don't point to existing fabrics
  - Image manifest archive_path files that don't exist on disk

Run:
    python scripts/validate_data.py            # exit non-zero on errors
    python scripts/validate_data.py --strict   # also fail on warnings
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ASSETS_ROOT = ROOT / "assets"

VALID_CATEGORIES = {"knit", "woven", "pu_suede", "home_textile"}
REQUIRED_FABRIC = ("id", "name", "category")
REQUIRED_SUPPLIER = ("name",)
THREE_SAVVA_EXPECTED_QUOTES = 7


class Validator:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed = 0

    def check(self, label: str, ok: bool, msg: str) -> None:
        self.passed += 1
        if not ok:
            self.errors.append(f"{label}: {msg}")

    def warn(self, label: str, msg: str) -> None:
        self.warnings.append(f"{label}: {msg}")

    def report(self, quiet: bool = False, strict: bool = False) -> int:
        if not quiet:
            print(f"checks: {self.passed}  errors: {len(self.errors)}  warnings: {len(self.warnings)}")
        for e in self.errors:
            print(f"  FAIL  {e}")
        for w in self.warnings:
            print(f"  WARN  {w}")
        if self.errors:
            return 1
        if strict and self.warnings:
            return 2
        return 0


def load_json(path: Path) -> dict | list | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def validate(v: Validator) -> None:
    fabrics_doc = load_json(DATA / "fabrics.json")
    suppliers_doc = load_json(DATA / "suppliers.json")
    manifest_doc = load_json(DATA / "image_manifest.json")

    v.check("data/fabrics.json", fabrics_doc is not None, "file missing or unparseable")
    v.check("data/suppliers.json", suppliers_doc is not None, "file missing or unparseable")
    v.check("data/image_manifest.json", manifest_doc is not None, "file missing or unparseable")
    if not fabrics_doc or not suppliers_doc or not manifest_doc:
        return 0

    fabrics = fabrics_doc.get("fabrics", [])
    suppliers = suppliers_doc.get("suppliers", [])
    manifest_items = manifest_doc.get("items", [])

    # ---- fabric structure ----
    fabric_ids: set[str] = set()
    for f in fabrics:
        fid = f.get("id", "<missing>")
        for field in REQUIRED_FABRIC:
            v.check(f"fabric {fid}.{field}", field in f and f[field], f"missing required field")

        if f.get("id") in fabric_ids:
            v.check(f"fabric {fid}", False, "duplicate id")
        fabric_ids.add(fid)

        cat = f.get("category")
        v.check(f"fabric {fid}.category", cat in VALID_CATEGORIES, f"invalid category {cat!r}")

        # 3S-AVVA invariants
        if f.get("supplier_brand") == "3S-AVVA":
            quotes = f.get("supplier_quotes") or []
            v.check(
                f"fabric {fid}.supplier_quotes",
                len(quotes) == THREE_SAVVA_EXPECTED_QUOTES,
                f"3S-AVVA expected {THREE_SAVVA_EXPECTED_QUOTES} quotes, got {len(quotes)}",
            )
            for q in quotes:
                v.check(
                    f"fabric {fid}.supplier_quotes[].supplier",
                    bool(q.get("supplier")),
                    "empty supplier name in quote",
                )
                v.check(
                    f"fabric {fid}.supplier_quotes[].price",
                    q.get("price_rmb_per_m") not in (None, ""),
                    "missing price in quote",
                )

    # ---- counts consistency ----
    declared_counts = fabrics_doc.get("counts") or {}
    v.check("fabrics.total vs len(fabrics)", fabrics_doc.get("total") == len(fabrics),
            f"declared total {fabrics_doc.get('total')} != actual {len(fabrics)}")
    v.check("sum(counts) vs total",
            sum(declared_counts.values()) == len(fabrics) == fabrics_doc.get("total"),
            f"sum(counts)={sum(declared_counts.values())} total={fabrics_doc.get('total')} len(fabrics)={len(fabrics)}")

    # Source key -> the supplier / brand used in records (3S-AVVA uses supplier_brand).
    source_to_supplier = {
        "huarui": "常熟市华瑞针纺织",
        "zhongtao": "中涛三时",
        "wantai": "万泰",
        "home_fr": "杭州辦事處",
        "3savva": "3S-AVVA",
    }
    for k, n in declared_counts.items():
        target = source_to_supplier.get(k)
        if target is None:
            v.warn("counts", f"unknown source key {k!r} - no mapping defined")
            continue
        actual = sum(
            1 for f in fabrics
            if (f.get("supplier") or f.get("supplier_brand")) == target
        )
        v.check(
            f"counts[{k}]",
            actual == n,
            f"declared {n} for {k!r}, observed {actual} fabrics with supplier {target!r}",
        )

    # ---- category distribution ----
    by_cat = Counter(f.get("category") for f in fabrics)
    for cat, n in by_cat.items():
        v.check(f"category {cat}", cat in VALID_CATEGORIES, "fabric has unknown category")
    if not by_cat:
        v.warn("category distribution", "no fabrics found")

    # ---- supplier structure ----
    for s in suppliers:
        sname = s.get("name", "<missing>")
        for field in REQUIRED_SUPPLIER:
            v.check(f"supplier {sname}.{field}", field in s and s[field], "missing required field")
        v.check(
            f"supplier {sname}.fabric_count",
            s.get("fabric_count") == len(s.get("fabric_ids") or []),
            f"fabric_count {s.get('fabric_count')} != len(fabric_ids) {len(s.get('fabric_ids') or [])}",
        )

    # ---- image manifest ----
    matched = 0
    for item in manifest_items:
        mid = item.get("matched_fabric_id")
        if mid:
            matched += 1
            v.check(
                f"image {item.get('original_filename')}.matched_fabric_id",
                mid in fabric_ids,
                f"matched_fabric_id {mid!r} not found in fabrics",
            )
        archive = item.get("archive_path", "")
        if archive:
            full = ROOT / archive
            if not full.exists():
                v.warn(
                    f"image {item.get('original_filename')}",
                    f"archive_path missing on disk: {archive}",
                )

    v.check("image_manifest.items", len(manifest_items) > 0, "no image items")
    v.warn(
        "image_manifest.matched",
        f"{matched} of {len(manifest_items)} images have a confirmed fabric match (rest are heuristic)",
    )

    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate data/*.json integrity.")
    ap.add_argument("--strict", action="store_true", help="Treat warnings as errors (non-zero exit).")
    ap.add_argument("--quiet", action="store_true", help="Only print failures.")
    args = ap.parse_args()
    v = Validator()
    validate(v)
    # Suppress all output when --quiet and nothing to report
    if args.quiet and not v.errors and not v.warnings:
        return 0
    return v.report(quiet=args.quiet, strict=args.strict)


if __name__ == "__main__":
    sys.exit(main())

# Fabric catalogue — data layer

This directory holds the cleaned JSON artefacts and image manifest produced by
the scripts in `../scripts/`. The source Excel/CSV/images stay untouched in
`../面料推荐档案/`.

## Files

| File | Purpose |
| --- | --- |
| `fabrics.json`     | Unified fabric catalogue (86 items across 4 categories). |
| `suppliers.json`   | Supplier directory derived from `fabrics.json` (12 entries). |
| `styles.json`      | Garment-style notes from the 3S-AVVA 2026.3.9 xlsx (14 entries). |
| `image_manifest.json` | Mapping of every source image to its archive path + best-effort fabric match. |

## Regenerate

```bash
# from project root
python scripts/extract_fabrics.py        # writes fabrics.json / suppliers.json / styles.json
python scripts/archive_images.py         # plan only (no copies)
python scripts/archive_images.py --apply # copy into assets/fabrics/
```

Both scripts are idempotent.

## Fabric schema (`fabrics.json`)

Top-level payload:

```jsonc
{
  "generated_at": "ISO timestamp",
  "schema_version": 1,
  "counts": { "huarui": 19, "zhongtao": 27, "wantai": 18, "home_fr": 9, "3savva": 13 },
  "total": 86,
  "fabrics": [ /* see Fabric record */ ]
}
```

Fabric record (fields vary slightly by source — only common fields are guaranteed):

| Field | Type | Notes |
| --- | --- | --- |
| `id`              | string  | Stable md5-prefix derived from `(source, code, name)`. |
| `supplier`        | string  | Main supplier of record (e.g. `常熟市华瑞针纺织`, `万泰`). |
| `supplier_brand`  | string  | Used when the sheet is a brand catalogue (e.g. `3S-AVVA`) instead of a mill. |
| `category`        | enum    | `knit` / `woven` / `pu_suede` / `home_textile`. |
| `name`            | string  | Display name. |
| `code`            | string  | Supplier product code (kept as string; may be a numeric 杭辦編號). |
| `composition_raw` | string  | Original composition string from the Excel cell. |
| `composition`     | object  | Parsed `{fiber: percent}`. Non-fibre tokens (`gsm`, `white`, ...) are stripped. |
| `weave`           | string  | Yarn / weave description (Zhongtao). |
| `structure`       | string  | Weave structure e.g. `PLAIN`, `TWILL 2/1`, `RIP-STOP` (Zhongtao). |
| `finish`          | string  | Finishing process (Zhongtao). |
| `spec_raw`        | string  | Original width/weight cell (e.g. `165cm×380g/㎡`). |
| `width_cm`        | number  | Width normalised to centimetres. Inches converted via ×2.54. |
| `weight_gsm`      | number  | Grams per square metre. Ranges (`180-200`) collapsed to midpoint with `weight_range` populated. |
| `weight_range`    | object  | `{min, max}` when input was a range, else `null`. |
| `features`        | array   | Free-text feature bullets (Huarui). |
| `applications`    | array   | Use-case tags (e.g. `["秋冬外套", "卫衣"]`). |
| `tags`            | array   | Derived texture tags (Wantai). |
| `texture`         | string  | Texture description (Wantai). |
| `color`           | string  | Colour family (Wantai). |
| `flame_retardant` | boolean | `true` for the home textile FR sheet. |
| `fr_standard`     | string  | e.g. `EN13773, Class I`. |
| `edge`            | string  | Edge finish (home textile). |
| `moq`             | number  | Minimum order quantity in metres. |
| `fob_usd_per_m`   | number  | FOB Shanghai price in USD/m. |
| `price_rmb_per_m` | number  | RMB price per metre (Zhongtao). |
| `supplier_quotes` | array   | 3S-AVVA multi-supplier block — see below. |
| `source_file`     | string  | Repo-relative path of the source xlsx. |
| `source_row`      | number  | 1-based row number in the source sheet. |
| `source_row_first`| number  | First row of a multi-row product (3S-AVVA only). |

### Multi-supplier quote (`supplier_quotes[]`)

```jsonc
{
  "supplier":        "绍兴宇翔布料有限公司",
  "price_rmb_per_m": 30,
  "moq":             "300米",
  "phone":           "0575-84785236",
  "email":           "yuxiang@yxcl.com"
}
```

`price_rmb_per_m` is sometimes a string in the source — check before arithmetic.

## Image manifest (`image_manifest.json`)

```jsonc
{
  "generated_at": "..."
  "archive_root": "assets/fabrics"
  "apply_mode":   true
  "counts": { "total": 30, "by_category": { "knit": 22, "home_textile": 8 }, "needs_review": 22 }
  "items": [
    {
      "original_path":       "面料推荐档案/面料推荐/20260601-103954.png",
      "original_filename":   "20260601-103954.png",
      "archive_path":        "assets/fabrics/knit/huarui/20260601-103954.png",
      "category_hint":       "knit",
      "supplier_hint":       "huarui",
      "match_reason":        "...",
      "match_confidence":    "medium",
      "size_bytes":          2000875,
      "sha1_8":              "1c7e5ab4",
      "needs_review":        true,
      "matched_fabric_id":   null,
      "matched_fabric_name": null,
      "copy_status":         "copied"
    }
  ]
}
```

### Manual review

`needs_review: true` flags images where the supplier hint is only a heuristic.
The 22 PNGs in `面料推荐/` are all assigned to `huarui` because that folder
contains the 华瑞针织面料汇总表.xlsx — verify by opening each PNG.

The 8 home-textile JPGs are matched to the 9 home_fr fabric rows by
alphabetical filename order against the `杭辦編號` sequence. Open
`面料推荐档案/家纺/260407 收到面料.xlsx` and reorder `matched_fabric_id` in
this manifest if the pairing is wrong.

## Open data gaps

- `moq` and `fob_usd_per_m` are missing on every `home_textile` row — the
  source sheet has the columns but the data cells are blank.
- `composition` percentages for `home_textile` records don't sum to 100
  (the source strings often omit the remainder, e.g. `57% PES / 3% Acrylic`).
- No prices or supplier contacts for the Huarui / Wantai / Zhongtao sheets —
  the source tables only describe the fabric, not commercial terms.
// Shared types for the fabric catalogue. Mirrors the JSON schema in data/README.md.

export type Category = "knit" | "woven" | "pu_suede" | "home_textile";

export interface WeightRange {
  min: number;
  max: number;
}

export interface SupplierQuote {
  supplier: string;
  price_rmb_per_m: number | string | null;
  moq: string | number | null;
  phone: string | null;
  email: string | null;
}

export interface Fabric {
  id: string;
  supplier?: string;
  supplier_brand?: string;
  category: Category;
  name: string;
  code: string | null;
  composition_raw?: string | null;
  composition?: Record<string, number>;
  weave?: string | null;
  structure?: string | null;
  finish?: string | null;
  spec_raw?: string | null;
  width_cm?: number | null;
  weight_gsm?: number | null;
  weight_range?: WeightRange | null;
  features?: string[];
  applications?: string[];
  tags?: string[];
  texture?: string | null;
  color?: string | null;
  flame_retardant?: boolean;
  fr_standard?: string | null;
  edge?: string | null;
  moq?: string | number | null;
  fob_usd_per_m?: number | string | null;
  price_rmb_per_m?: number | string | null;
  supplier_quotes?: SupplierQuote[];
  source_file?: string;
  source_row?: number | null;
  source_row_first?: number | null;
}

export interface Supplier {
  name: string;
  phone: string | null;
  email: string | null;
  quote_count: number;
  fabric_count: number;
  fabric_ids: string[];
}

export interface StyleNote {
  id: string;
  supplier_brand: string;
  category: "knit_style";
  style_description: string;
  fabric_description: string | null;
  fabric_composition: Record<string, number>;
  extra_notes: string | null;
  source_file?: string;
}

export interface ImageManifestItem {
  original_path: string;
  original_filename: string;
  archive_path: string;
  category_hint: string;
  supplier_hint: string;
  match_reason: string;
  match_confidence: "high" | "medium" | "low";
  size_bytes: number;
  sha1_8: string;
  needs_review: boolean;
  matched_fabric_id: string | null;
  matched_fabric_name: string | null;
  copy_status: string;
}

export interface ImageManifest {
  generated_at: string;
  archive_root: string;
  apply_mode: boolean;
  counts: { total: number; by_category: Record<string, number>; needs_review: number };
  items: ImageManifestItem[];
}

export const CATEGORY_LABEL: Record<Category, string> = {
  knit: "针织",
  woven: "化纤梭织",
  pu_suede: "PU 麂皮",
  home_textile: "家纺阻燃",
};

export const CATEGORY_DESC: Record<Category, string> = {
  knit: "摇粒绒 / 卫衣 / Polo / 网眼",
  woven: "裤料 / 外套 / 防晒 / 冲锋衣",
  pu_suede: "鞋面 / 箱包 / 装饰面料",
  home_textile: "EN13773 阻燃窗帘与沙发布",
};

export const FIBER_LABEL: Record<string, string> = {
  polyester: "涤纶",
  recycled_polyester: "再生涤",
  cotton: "棉",
  nylon: "锦纶",
  spandex: "氨纶",
  modal: "莫代尔",
  rayon: "粘胶",
  linen: "亚麻",
  acrylic: "腈纶",
};

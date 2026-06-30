// src/types/db.ts
// Database row types — match the SQL schema 1:1.

import type { Category } from './api.js';

// ---------- users ----------
export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  email: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface UserWithRoles extends UserRow {
  roles: string[]; // ['admin', 'purchaser', ...]
}

// ---------- roles ----------
export interface RoleRow {
  id: number;
  code: string;
  name_zh: string;
  description: string | null;
}

export interface UserRoleRow {
  user_id: string;
  role_id: number;
}

// ---------- dictionaries ----------
export interface CategoryRow {
  code: Category;
  name_zh: string;
  description: string | null;
  sort_order: number;
}

export interface SupplierRow {
  id: string;
  name: string;
  short_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
}

export interface WeaveRow {
  id: number;
  code: string;
  name_zh: string;
  sort_order: number;
}

export interface SeasonRow {
  id: number;
  code: string;
  name_zh: string;
  sort_order: number;
}

export interface GarmentStyleRow {
  id: number;
  code: string;
  name_zh: string;
  sort_order: number;
}

export interface FeatureTagRow {
  id: number;
  code: string;
  name_zh: string;
  sort_order: number;
}

export interface FinishRow {
  id: number;
  code: string;
  name_zh: string;
  sort_order: number;
}

// ---------- fabrics ----------
export type FabricStatus = 'active' | 'inactive' | 'draft';

export interface FabricRow {
  id: string; // 12-char md5 prefix, preserved from JSON
  code: string | null;
  name: string;
  category_code: Category;
  supplier_id: string;
  supplier_brand: string | null;
  composition_raw: string | null;
  spec_raw: string | null;
  weave_code: string | null;
  structure: string | null;
  finish_raw: string | null;
  width_cm: number | null;
  weight_gsm: number | null;
  weight_range_min: number | null;
  weight_range_max: number | null;
  texture: string | null;
  color: string | null;
  flame_retardant: boolean;
  fr_standard: string | null;
  edge: string | null;
  moq: string | null;
  fob_usd_per_m: number | null;
  price_rmb_per_m: number | null;
  // 钉钉 AI 字段
  season_codes: string | null;          // JSON array of codes
  recommended_style_codes: string | null; // JSON array
  selling_points: string | null;
  similar_fabric_ids: string | null;   // JSON array
  notes: string | null;
  // 元数据
  source_file: string | null;
  source_row: number | null;
  imported_at: Date | null;
  // 通用
  status: FabricStatus;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
}

export interface FabricCompositionRow {
  fabric_id: string;
  fiber_code: string;
  percentage: number;
}

export type FabricImageSource = 'archive' | 'uploaded';

export interface FabricImageRow {
  id: string;
  fabric_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
  is_cover: boolean;
  source: FabricImageSource;
  sha1_8: string | null;
  created_at: Date;
}

export interface FabricSeasonRow {
  fabric_id: string;
  season_code: string;
}

export interface FabricGarmentStyleRow {
  fabric_id: string;
  garment_style_code: string;
}

export interface FabricFeatureTagRow {
  fabric_id: string;
  feature_tag_code: string;
}

export interface FabricFinishRow {
  fabric_id: string;
  finish_code: string;
}

export interface SupplierQuoteRow {
  id: string;
  fabric_id: string;
  supplier_name: string;
  price_rmb_per_m: number | null;
  moq: string | null;
  phone: string | null;
  email: string | null;
  sort_order: number;
}

// ---------- style notes ----------
export interface StyleNoteRow {
  id: string;
  supplier_brand: string;
  style_description: string | null;
  fabric_description: string | null;
  extra_notes: string | null;
  source_file: string | null;
  source_row: number | null;
  is_deleted: boolean;
  created_at: Date;
}

export interface StyleNoteCompositionRow {
  style_note_id: string;
  fiber_code: string;
  percentage: number;
}

// ---------- similarities ----------
export interface FabricSimilarityRow {
  fabric_id: string;
  similar_fabric_id: string;
  score: number;
  reason: string | null;
}

// ---------- audit / import ----------
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'IMPORT' | 'EXPORT' | 'STATUS_CHANGE';

export interface AuditLogRow {
  id: number;
  user_id: string | null;
  username: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  before_value: string | null; // JSON
  after_value: string | null;  // JSON
  ip: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface ImportBatchRow {
  id: string;
  filename: string;
  file_hash: string | null;
  total_rows: number;
  success_count: number;
  failed_count: number;
  error_report: string | null; // JSON
  user_id: string | null;
  created_at: Date;
  finished_at: Date | null;
}

// ---------- refresh tokens ----------
export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

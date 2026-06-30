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

// ============================================================================
// API DTOs — types matching the backend API response shapes (server/src/types/api.ts)
// ============================================================================

export type FabricStatus = "active" | "inactive" | "draft";
export type UserRoleCode = "admin" | "purchaser" | "viewer";

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  roles: UserRoleCode[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface FabricListItemDto {
  id: string;
  name: string;
  code: string | null;
  category: Category;
  categoryLabel: string;
  supplierName: string | null;
  supplierBrand: string | null;
  weightGsm: number | null;
  priceRmbPerM: number | null;
  coverImageUrl: string | null;
  compositionLabel: string | null;
  sellingPoints: string | null;
  status: FabricStatus;
  updatedAt: string | null;
}

export interface FabricCompositionDto {
  fiberCode: string;
  fiberLabel: string;
  percentage: number;
}

export interface FabricImageDto {
  id: string;
  url: string;
  fullUrl: string;
  alt: string | null;
  isCover: boolean;
  sortOrder: number;
}

export interface SupplierQuoteDto {
  id: string;
  supplierName: string;
  priceRmbPerM: number | null;
  moq: string | null;
  phone: string | null;
  email: string | null;
}

export interface FabricDetailDto extends FabricListItemDto {
  compositionRaw: string | null;
  specRaw: string | null;
  structure: string | null;
  finishRaw: string | null;
  widthCm: number | null;
  weightRangeMin: number | null;
  weightRangeMax: number | null;
  texture: string | null;
  color: string | null;
  flameRetardant: boolean;
  frStandard: string | null;
  edge: string | null;
  moq: string | null;
  fobUsdPerM: number | null;
  notes: string | null;
  compositions: FabricCompositionDto[];
  images: FabricImageDto[];
  seasons: { code: string; label: string }[];
  garmentStyles: { code: string; label: string }[];
  featureTags: { code: string; label: string }[];
  finishes: { code: string; label: string }[];
  supplierQuotes: SupplierQuoteDto[];
  similarFabrics: FabricListItemDto[];
}

export interface FabricListQuery {
  category?: Category;
  supplierId?: string;
  season?: string;
  garmentStyle?: string;
  featureTag?: string;
  weightMin?: number;
  weightMax?: number;
  priceMin?: number;
  priceMax?: number;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: "updated_desc" | "weight_asc" | "weight_desc" | "price_asc" | "price_desc";
}

export interface DictItemDto<TCode = string, TLabel = string> {
  code: TCode;
  label: TLabel;
  sortOrder: number;
}

export interface SupplierDictDto {
  id: string;
  name: string;
  shortName: string | null;
}

export interface DictionaryBundle {
  categories: DictItemDto<Category, string>[];
  seasons: DictItemDto<string, string>[];
  garmentStyles: DictItemDto<string, string>[];
  featureTags: DictItemDto<string, string>[];
  finishes: DictItemDto<string, string>[];
  suppliers: SupplierDictDto[];
}

export interface CreateFabricRequest {
  code?: string | null;
  name: string;
  category: Category;
  supplierId: string;
  supplierBrand?: string | null;
  compositionRaw?: string | null;
  specRaw?: string | null;
  widthCm?: number | null;
  weightGsm?: number | null;
  weightRangeMin?: number | null;
  weightRangeMax?: number | null;
  structure?: string | null;
  finishRaw?: string | null;
  texture?: string | null;
  color?: string | null;
  flameRetardant?: boolean;
  frStandard?: string | null;
  edge?: string | null;
  moq?: string | null;
  fobUsdPerM?: number | null;
  priceRmbPerM?: number | null;
  sellingPoints?: string | null;
  notes?: string | null;
  compositions?: { fiberCode: string; percentage: number }[];
  seasons?: string[];
  garmentStyles?: string[];
  featureTags?: string[];
  finishes?: string[];
  status?: FabricStatus;
}

export interface ImportErrorRow {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResultDto {
  batchId: string;
  filename: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  errors: ImportErrorRow[];
  durationMs: number;
}

export interface AdminUserDto {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  isActive: boolean;
  roles: UserRoleCode[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  displayName?: string | null;
  email?: string | null;
  roles: UserRoleCode[];
  isActive?: boolean;
}

export interface UpdateUserRequest {
  displayName?: string | null;
  email?: string | null;
  roles?: UserRoleCode[];
  isActive?: boolean;
}

export interface DashboardStats {
  totalFabrics: number;
  activeFabrics: number;
  draftFabrics: number;
  inactiveFabrics: number;
  totalSuppliers: number;
  totalUsers: number;
  newLast7Days: number;
  recentAudits: {
    id: number;
    username: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
  }[];
}

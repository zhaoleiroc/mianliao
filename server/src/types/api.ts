// src/types/api.ts
// API DTOs — what flows over the wire.

export type Category = 'knit' | 'woven' | 'pu_suede' | 'home_textile';

export type FabricStatus = 'active' | 'inactive' | 'draft';

export type UserRoleCode = 'admin' | 'purchaser' | 'viewer';

// ---------- Response envelope ----------
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

// ---------- Auth ----------
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

// ---------- Fabric DTOs ----------
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
  compositionLabel: string | null; // e.g. "涤94 氨6"
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
  url: string;       // relative or absolute
  fullUrl: string;   // resolved with API base
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
  sort?: 'updated_desc' | 'weight_asc' | 'weight_desc' | 'price_asc' | 'price_desc';
}

// ---------- Dictionary DTOs ----------
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

// ---------- Admin DTOs ----------
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

export type UpdateFabricRequest = CreateFabricRequest;

export interface StatusChangeRequest {
  status: FabricStatus;
  expectedVersion?: string; // base64 rowversion
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

export interface ResetPasswordRequest {
  newPassword: string;
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

// src/types/api.ts
// Re-export API DTOs from the canonical src/types.ts for cleaner imports
// like `import type { ... } from '../types/api'`.

export type {
  Category,
  FabricStatus,
  UserRoleCode,
  ApiResponse,
  PagedResult,
  LoginRequest,
  AuthUser,
  LoginResponse,
  RefreshRequest,
  FabricListItemDto,
  FabricCompositionDto,
  FabricImageDto,
  SupplierQuoteDto,
  FabricDetailDto,
  FabricListQuery,
  DictItemDto,
  SupplierDictDto,
  DictionaryBundle,
  CreateFabricRequest,
  ImportErrorRow,
  ImportResultDto,
  AdminUserDto,
  CreateUserRequest,
  UpdateUserRequest,
  DashboardStats,
} from '../types';

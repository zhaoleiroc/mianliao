// src/api/admin.ts
// Admin API calls.

import { request } from './client';
import type {
  AdminUserDto,
  CreateUserRequest,
  UpdateUserRequest,
  CreateFabricRequest,
  DashboardStats,
  FabricListItemDto,
  FabricStatus,
  ImportResultDto,
  PagedResult,
  UserRoleCode,
} from '../types';

export async function fetchDashboard(): Promise<DashboardStats> {
  return request<DashboardStats>('/api/admin/dashboard');
}

export interface AdminFabricListParams {
  category?: string;
  status?: FabricStatus;
  q?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export async function adminListFabrics(
  params: AdminFabricListParams = {},
): Promise<PagedResult<FabricListItemDto>> {
  return request<PagedResult<FabricListItemDto>>('/api/admin/fabrics', { query: params as any });
}

export async function adminCreateFabric(input: CreateFabricRequest): Promise<{ id: string }> {
  return request<{ id: string }>('/api/admin/fabrics', { method: 'POST', body: input });
}

export async function adminUpdateFabric(id: string, input: CreateFabricRequest): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/admin/fabrics/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  });
}

export async function adminChangeStatus(id: string, status: FabricStatus): Promise<void> {
  await request(`/api/admin/fabrics/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export async function adminDeleteFabric(id: string): Promise<void> {
  await request(`/api/admin/fabrics/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function adminImportFabrics(file: File): Promise<ImportResultDto> {
  const fd = new FormData();
  fd.append('file', file);
  return request<ImportResultDto>('/api/admin/fabrics/import', {
    method: 'POST',
    formData: fd,
  });
}

// ---------- Users ----------
export async function adminListUsers(): Promise<AdminUserDto[]> {
  return request<AdminUserDto[]>('/api/admin/users');
}

export async function adminCreateUser(input: CreateUserRequest): Promise<AdminUserDto> {
  return request<AdminUserDto>('/api/admin/users', { method: 'POST', body: input });
}

export async function adminUpdateUser(id: string, input: UpdateUserRequest): Promise<AdminUserDto> {
  return request<AdminUserDto>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  });
}

export async function adminResetPassword(id: string, newPassword: string): Promise<void> {
  await request(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    body: { newPassword },
  });
}

export async function adminDeleteUser(id: string): Promise<void> {
  await request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---------- Audit logs ----------
export interface AuditQueryParams {
  user?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditEntry {
  id: number;
  username: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export async function adminListAudits(params: AuditQueryParams = {}): Promise<PagedResult<AuditEntry>> {
  return request<PagedResult<AuditEntry>>('/api/admin/audit-logs', { query: params as any });
}

// ---------- Dictionaries ----------
export interface DictRow {
  code: string;
  label: string;
  sortOrder: number;
}

export async function adminListDict(type: string): Promise<DictRow[]> {
  return request<DictRow[]>(`/api/fabrics/_/dictionaries/${encodeURIComponent(type)}`);
}

export async function adminCreateDictItem(
  type: string,
  input: { code: string; nameZh: string; sortOrder?: number },
): Promise<void> {
  await request(`/api/admin/dictionaries/${encodeURIComponent(type)}`, {
    method: 'POST',
    body: input,
  });
}

export async function adminUpdateDictItem(
  type: string,
  code: string,
  input: { nameZh?: string; sortOrder?: number },
): Promise<void> {
  await request(`/api/admin/dictionaries/${encodeURIComponent(type)}/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: input,
  });
}

export async function adminDeleteDictItem(type: string, code: string): Promise<void> {
  await request(`/api/admin/dictionaries/${encodeURIComponent(type)}/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
}

// ---------- Suppliers ----------
export interface SupplierRow {
  id: string;
  name: string;
  shortName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  fabricCount: number;
}

export async function adminListSuppliers(): Promise<SupplierRow[]> {
  return request<SupplierRow[]>('/api/admin/suppliers');
}

export async function adminCreateSupplier(input: {
  name: string;
  shortName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<{ id: string }> {
  return request<{ id: string }>('/api/admin/suppliers', { method: 'POST', body: input });
}

// re-export role type for admin pages
export type { UserRoleCode };

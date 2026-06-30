// src/api/fabrics.ts
// Public fabric API.

import { request, imageUrl, type PagedResult } from './client';
import type {
  FabricListItemDto,
  FabricDetailDto,
  FabricListQuery,
  DictionaryBundle,
  DictItemDto,
  SupplierDictDto,
} from '../types/api';

export interface FabricListParams {
  category?: string;
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
  sort?: FabricListQuery['sort'];
}

export async function fetchFabrics(params: FabricListParams = {}): Promise<PagedResult<FabricListItemDto>> {
  return request<PagedResult<FabricListItemDto>>('/api/fabrics', { query: params as any });
}

export async function fetchFabricDetail(id: string): Promise<FabricDetailDto> {
  return request<FabricDetailDto>(`/api/fabrics/${encodeURIComponent(id)}`);
}

export async function fetchSimilarFabrics(id: string): Promise<FabricListItemDto[]> {
  return request<FabricListItemDto[]>(`/api/fabrics/${encodeURIComponent(id)}/similar`);
}

export async function fetchDictionaries(): Promise<DictionaryBundle> {
  return request<DictionaryBundle>('/api/fabrics/_/dictionaries');
}

export async function fetchDictionary(type: string): Promise<DictItemDto[] | SupplierDictDto[]> {
  return request(`/api/fabrics/_/dictionaries/${encodeURIComponent(type)}`);
}

export { imageUrl };

// src/utils/response.ts
// Standardized API response envelope + pagination helpers.

import type { Response } from 'express';
import type { ApiResponse, PagedResult } from '../types/api.js';

export const ErrorCode = {
  OK: 0,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  UnprocessableEntity: 422,
  Internal: 500,
} as const;

export function ok<T>(res: Response, data: T): Response {
  const body: ApiResponse<T> = { code: 0, message: 'ok', data };
  return res.json(body);
}

export function fail(
  res: Response,
  status: number,
  message: string,
  data: unknown = null,
): Response {
  const body: ApiResponse<unknown> = { code: status, message, data };
  return res.status(status).json(body);
}

export function paged<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PagedResult<T> {
  return { items, total, page, pageSize };
}

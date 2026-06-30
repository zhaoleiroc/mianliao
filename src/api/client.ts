// src/api/client.ts
// Lightweight fetch wrapper with JWT injection and standardized error handling.

import type { ApiResponse, PagedResult } from '../types/api';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

const TOKEN_KEY = 'mianliao.auth';
const REFRESH_KEY = 'mianliao.refresh';
const USER_KEY = 'mianliao.user';

export function getStoredAuth(): { token: string; refresh: string; user: unknown } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const refresh = localStorage.getItem(REFRESH_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  if (!token || !refresh) return null;
  try {
    return { token, refresh, user: userRaw ? JSON.parse(userRaw) : null };
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, refresh: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  code: number;
  data: unknown;
  constructor(status: number, code: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  // When true, attach Authorization header if a token exists
  auth?: boolean;
  // When true, don't throw on 401 — return the response so caller can handle
  skipAuthRedirect?: boolean;
  // Override default JSON content-type
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '') continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.query);
  const headers: Record<string, string> = {};
  if (!opts.formData) {
    headers['Content-Type'] = 'application/json';
  }
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
  }
  if (opts.auth !== false) {
    const auth = getStoredAuth();
    if (auth) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }
  }
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
    body,
    signal: opts.signal,
  };
  const res = await fetch(url, init);

  // 401: try refresh once
  if (res.status === 401 && !opts.skipAuthRedirect) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // retry once
      return request<T>(path, { ...opts, skipAuthRedirect: true });
    }
    // can't refresh — clear and redirect
    clearStoredAuth();
    if (window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/admin/login')) {
      window.location.href = '/admin/login';
    }
    const json = await safeJson(res);
    throw new ApiError(401, json?.code ?? 401, json?.message ?? '未登录', json?.data ?? null);
  }

  const json = (await safeJson(res)) as ApiResponse<T> | null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.code ?? res.status, json?.message ?? `HTTP ${res.status}`, json?.data ?? null);
  }
  if (json && typeof json === 'object' && 'code' in json) {
    if (json.code !== 0) {
      throw new ApiError(res.status, json.code, json.message, json.data);
    }
    // Server-side success envelopes always carry a `data` field. If the
    // backend returned `null` (e.g. 204-style "no body"), don't lie about the
    // shape — surface a clear ApiError so callers don't try `null.items`.
    if (json.data === null || json.data === undefined) {
      throw new ApiError(res.status, 500, '服务端返回空数据', null);
    }
    return json.data as T;
  }
  // We expected a JSON envelope but got something else — likely an HTML
  // SPA fallback (200 with <!doctype html>) when a relative `/api/...`
  // path resolves to the dev server instead of the API. Surface this
  // explicitly so we don't silently return `null` and crash callers
  // downstream with `null.items`.
  throw new ApiError(
    res.status,
    0,
    'API 返回非 JSON 响应（多半是 VITE_API_BASE 没设 / 后端未启动）',
    null,
  );
}

async function tryRefresh(): Promise<boolean> {
  const auth = getStoredAuth();
  if (!auth) return false;
  try {
    const res = await fetch(buildUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refresh }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const data = json?.data;
    if (!data) return false;
    setStoredAuth(data.accessToken, data.refreshToken, data.user);
    return true;
  } catch {
    return false;
  }
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function apiBase(): string {
  return API_BASE;
}

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  // archive/* paths come from the API. Server stores files under
  // server/wwwroot/uploads/archive/ and exposes them via Express static
  // mounted at /uploads (see server/src/index.ts). Prepend /uploads so the
  // browser can fetch them through Vite's /api → :5001 proxy (or directly
  // against the API base in production).
  if (path.startsWith('archive/')) {
    return `${API_BASE}/uploads/${path}`;
  }
  // assets/* paths come from Vite publicDir (legacy static catalogue).
  if (path.startsWith('assets/')) {
    return `${import.meta.env.BASE_URL}${path}`;
  }
  return `${API_BASE}/${path.replace(/^\/+/, '')}`;
}

// Re-export PagedResult for convenience
export type { PagedResult };

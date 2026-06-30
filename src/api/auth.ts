// src/api/auth.ts
// Auth API.

import { request } from './client';
import { setStoredAuth, clearStoredAuth, getStoredAuth } from './client';
import type { AuthUser, LoginResponse, RefreshRequest } from '../types/api';

export async function login(username: string, password: string): Promise<LoginResponse> {
  const result = await request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
  setStoredAuth(result.accessToken, result.refreshToken, result.user);
  return result;
}

export async function logout(): Promise<void> {
  const auth = getStoredAuth();
  if (auth) {
    try {
      await request<void>('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken: auth.refresh } as RefreshRequest,
      });
    } catch {
      // ignore — we're clearing anyway
    }
  }
  clearStoredAuth();
}

export async function fetchMe(): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me');
}

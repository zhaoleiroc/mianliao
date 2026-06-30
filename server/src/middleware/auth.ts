// src/middleware/auth.ts
// JWT verification + role-based authorization.

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/jwt.js';
import { fail } from '../utils/response.js';
import type { UserRoleCode } from '../types/api.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

/** Require a valid access token. Populates req.auth. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    fail(res, 401, '未登录');
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (err) {
    fail(res, 401, '登录已过期，请重新登录');
  }
}

/** Optional auth: parse if present, but don't reject. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    try {
      req.auth = verifyAccessToken(token);
    } catch {
      // ignore — public access still allowed
    }
  }
  next();
}

/** Require the authenticated user to have at least one of the listed roles. */
export function requireRole(...allowed: UserRoleCode[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      fail(res, 401, '未登录');
      return;
    }
    const userRoles = req.auth.roles as UserRoleCode[];
    if (!userRoles.some((r) => allowed.includes(r))) {
      fail(res, 403, '权限不足');
      return;
    }
    next();
  };
}

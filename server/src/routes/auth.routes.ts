// src/routes/auth.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { ok, fail } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    await recordAudit({
      userId: result.user.id,
      username: result.user.username,
      action: 'LOGIN',
      entityType: 'auth',
      entityId: result.user.id,
      beforeValue: null,
      afterValue: null,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, result);
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const input = refreshSchema.parse(req.body);
    const result = await authService.refresh(input.refreshToken);
    return ok(res, result);
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const input = refreshSchema.parse(req.body);
    await authService.logout(input.refreshToken);
    return ok(res, { ok: true });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await authService.getMe(req.auth!.sub);
    return ok(res, me);
  }),
);

export default router;

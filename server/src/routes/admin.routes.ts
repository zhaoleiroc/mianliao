// src/routes/admin.routes.ts
// Admin endpoints — fabrics, dictionaries, users, audit, import, dashboard.

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import * as fabricService from '../services/fabric.service.js';
import * as dictService from '../services/dict.service.js';
import * as userService from '../services/auth.service.js';
import * as auditService from '../services/audit.service.js';
import * as importService from '../services/import.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ok, paged, fail } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { saveFabricImage } from '../utils/upload.js';
import { validatePassword } from '../utils/password.js';
import { BadRequestError, NotFoundError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { config } from '../config/index.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.upload.maxSize } });

// All admin routes require auth + admin or purchaser role
router.use(requireAuth);
router.use(requireRole('admin', 'purchaser'));

// ---------- Dashboard ----------
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const stats = await fabricService.getDashboardStats();
    return ok(res, stats);
  }),
);

// ---------- Fabrics (admin) ----------
const adminListQuerySchema = z.object({
  category: z.enum(['knit', 'woven', 'pu_suede', 'home_textile']).optional(),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

router.get(
  '/fabrics',
  asyncHandler(async (req, res) => {
    const q = adminListQuerySchema.parse(req.query);
    const result = await fabricService.adminListFabrics(q);
    return ok(res, paged(result.items, result.total, q.page ?? 1, q.pageSize ?? 24));
  }),
);

const fabricWriteSchema = z.object({
  code: z.string().max(64).nullish(),
  name: z.string().min(1).max(128),
  category: z.enum(['knit', 'woven', 'pu_suede', 'home_textile']),
  supplierId: z.string().uuid(),
  supplierBrand: z.string().max(64).nullish(),
  compositionRaw: z.string().max(255).nullish(),
  specRaw: z.string().max(64).nullish(),
  widthCm: z.number().int().nullish(),
  weightGsm: z.number().int().nullish(),
  weightRangeMin: z.number().int().nullish(),
  weightRangeMax: z.number().int().nullish(),
  structure: z.string().max(64).nullish(),
  finishRaw: z.string().max(64).nullish(),
  texture: z.string().max(64).nullish(),
  color: z.string().max(64).nullish(),
  flameRetardant: z.boolean().optional(),
  frStandard: z.string().max(64).nullish(),
  edge: z.string().max(64).nullish(),
  moq: z.string().max(32).nullish(),
  fobUsdPerM: z.number().nullish(),
  priceRmbPerM: z.number().nullish(),
  sellingPoints: z.string().nullish(),
  notes: z.string().nullish(),
  compositions: z.array(z.object({ fiberCode: z.string(), percentage: z.number() })).optional(),
  seasons: z.array(z.string()).optional(),
  garmentStyles: z.array(z.string()).optional(),
  featureTags: z.array(z.string()).optional(),
  finishes: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
});

router.post(
  '/fabrics',
  asyncHandler(async (req, res) => {
    const input = fabricWriteSchema.parse(req.body);
    const userId = req.auth!.sub;
    const username = req.auth!.username;
    const id = await fabricService.adminCreateFabric(input, username);
    await recordAudit({
      userId, username, action: 'CREATE', entityType: 'fabric', entityId: id,
      beforeValue: null, afterValue: input, ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, { id });
  }),
);

router.put(
  '/fabrics/:id',
  asyncHandler(async (req, res) => {
    const input = fabricWriteSchema.parse(req.body);
    const userId = req.auth!.sub;
    const username = req.auth!.username;
    await fabricService.adminUpdateFabric(req.params.id, input, username);
    await recordAudit({
      userId, username, action: 'UPDATE', entityType: 'fabric', entityId: req.params.id,
      beforeValue: null, afterValue: input, ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, { id: req.params.id });
  }),
);

router.delete(
  '/fabrics/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.sub;
    const username = req.auth!.username;
    await fabricService.adminDeleteFabric(req.params.id, username);
    await recordAudit({
      userId, username, action: 'DELETE', entityType: 'fabric', entityId: req.params.id,
      beforeValue: null, afterValue: null, ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, { id: req.params.id });
  }),
);

const statusSchema = z.object({ status: z.enum(['active', 'inactive', 'draft']) });

router.patch(
  '/fabrics/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    const username = req.auth!.username;
    await fabricService.adminChangeStatus(req.params.id, status, username);
    await recordAudit({
      userId: req.auth!.sub, username, action: 'STATUS_CHANGE', entityType: 'fabric', entityId: req.params.id,
      beforeValue: null, afterValue: { status }, ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, { id: req.params.id, status });
  }),
);

// ---------- Images ----------
router.post(
  '/fabrics/:id/images',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('缺少文件');
    const detail = await fabricService.getFabricDetail(req.params.id);
    const saved = await saveFabricImage(
      req.file,
      detail.category,
      detail.supplierBrand,
    );
    const imageId = await fabricService.adminAddImage(req.params.id, {
      url: saved.urlPath,
      sortOrder: Number(req.body?.sortOrder ?? 0),
      isCover: req.body?.isCover === 'true' || req.body?.isCover === true,
      source: 'uploaded',
    });
    return ok(res, { id: imageId, url: saved.urlPath });
  }),
);

router.delete(
  '/fabrics/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    await fabricService.adminDeleteImage(req.params.id, req.params.imageId);
    return ok(res, { ok: true });
  }),
);

router.patch(
  '/fabrics/:id/images/:imageId/cover',
  asyncHandler(async (req, res) => {
    await fabricService.adminSetCoverImage(req.params.id, req.params.imageId);
    return ok(res, { ok: true });
  }),
);

// ---------- Import ----------
router.post(
  '/fabrics/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('缺少文件');
    const result = await importService.importFabrics(
      req.file,
      req.auth!.sub,
    );
    await recordAudit({
      userId: req.auth!.sub, username: req.auth!.username, action: 'IMPORT',
      entityType: 'fabric', entityId: result.batchId,
      beforeValue: null, afterValue: { totalRows: result.totalRows, successCount: result.successCount, failedCount: result.failedCount },
      ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, result);
  }),
);

router.get(
  '/import-batches/:id',
  asyncHandler(async (req, res) => {
    const batch = await importService.getImportBatch(req.params.id);
    if (!batch) throw new NotFoundError('批次不存在');
    return ok(res, batch);
  }),
);

// ---------- Dictionaries ----------
const dictItemSchema = z.object({
  code: z.string().min(1).max(64),
  nameZh: z.string().min(1).max(64),
  sortOrder: z.number().int().optional(),
});

const dictUpdateSchema = z.object({
  nameZh: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

router.post(
  '/dictionaries/:type',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (!dictService.isDictType(req.params.type)) {
      return fail(res, 400, `未知字典类型: ${req.params.type}`);
    }
    const input = dictItemSchema.parse(req.body);
    await dictService.dictItemCreate(req.params.type, input);
    return ok(res, { ok: true });
  }),
);

router.put(
  '/dictionaries/:type/:code',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (!dictService.isDictType(req.params.type)) {
      return fail(res, 400, `未知字典类型: ${req.params.type}`);
    }
    const input = dictUpdateSchema.parse(req.body);
    await dictService.dictItemUpdate(req.params.type, req.params.code, input);
    return ok(res, { ok: true });
  }),
);

router.delete(
  '/dictionaries/:type/:code',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (!dictService.isDictType(req.params.type)) {
      return fail(res, 400, `未知字典类型: ${req.params.type}`);
    }
    await dictService.dictItemDelete(req.params.type, req.params.code);
    return ok(res, { ok: true });
  }),
);

// ---------- Suppliers ----------
const supplierSchema = z.object({
  name: z.string().min(1).max(128),
  shortName: z.string().max(32).nullish(),
  phone: z.string().max(32).nullish(),
  email: z.string().email().max(128).nullish(),
  address: z.string().max(255).nullish(),
  notes: z.string().nullish(),
});

const supplierUpdateSchema = supplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

router.get(
  '/suppliers',
  asyncHandler(async (_req, res) => {
    const list = await dictService.listSuppliersFull();
    return ok(res, list);
  }),
);

router.post(
  '/suppliers',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const input = supplierSchema.parse(req.body);
    const id = await dictService.createSupplier(input);
    return ok(res, { id });
  }),
);

router.put(
  '/suppliers/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const input = supplierUpdateSchema.parse(req.body);
    await dictService.updateSupplier(req.params.id, input);
    return ok(res, { ok: true });
  }),
);

router.delete(
  '/suppliers/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await dictService.deleteSupplier(req.params.id);
    return ok(res, { ok: true });
  }),
);

// ---------- Users (admin only) ----------
const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8).max(64),
  displayName: z.string().max(64).nullish(),
  email: z.string().email().max(128).nullish(),
  roles: z.array(z.enum(['admin', 'purchaser', 'viewer'])).min(1),
  isActive: z.boolean().optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().max(64).nullish(),
  email: z.string().email().max(128).nullish(),
  roles: z.array(z.enum(['admin', 'purchaser', 'viewer'])).optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({ newPassword: z.string().min(8).max(64) });

router.get(
  '/users',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const list = await userService.listUsers();
    return ok(res, list);
  }),
);

router.post(
  '/users',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const input = createUserSchema.parse(req.body);
    const pwErr = validatePassword(input.password);
    if (pwErr) throw new BadRequestError(pwErr);
    const user = await userService.createUser(input);
    await recordAudit({
      userId: req.auth!.sub, username: req.auth!.username, action: 'CREATE',
      entityType: 'user', entityId: user.id,
      beforeValue: null, afterValue: { username: user.username, roles: user.roles },
      ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, user);
  }),
);

router.put(
  '/users/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const input = updateUserSchema.parse(req.body);
    // Self-protection: cannot disable own account or remove own last admin role
    if (req.params.id === req.auth!.sub) {
      if (input.isActive === false) {
        throw new BadRequestError('不能停用自己的账号');
      }
      if (input.roles && !input.roles.includes('admin')) {
        throw new BadRequestError('不能移除自己的 admin 角色');
      }
    }
    const user = await userService.updateUser(req.params.id, input);
    await recordAudit({
      userId: req.auth!.sub, username: req.auth!.username, action: 'UPDATE',
      entityType: 'user', entityId: req.params.id,
      beforeValue: null, afterValue: input, ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, user);
  }),
);

router.post(
  '/users/:id/reset-password',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { newPassword } = resetPasswordSchema.parse(req.body);
    const pwErr = validatePassword(newPassword);
    if (pwErr) throw new BadRequestError(pwErr);
    await userService.resetUserPassword(req.params.id, newPassword);
    await recordAudit({
      userId: req.auth!.sub, username: req.auth!.username, action: 'UPDATE',
      entityType: 'user', entityId: req.params.id, beforeValue: null,
      afterValue: { action: 'reset_password' },
      ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, { ok: true });
  }),
);

router.delete(
  '/users/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth!.sub) {
      throw new BadRequestError('不能删除自己的账号');
    }
    await userService.deleteUser(req.params.id);
    await recordAudit({
      userId: req.auth!.sub, username: req.auth!.username, action: 'DELETE',
      entityType: 'user', entityId: req.params.id,
      beforeValue: null, afterValue: null, ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return ok(res, { ok: true });
  }),
);

// ---------- Audit logs (admin only) ----------
const auditQuerySchema = z.object({
  user: z.string().optional(),
  entityType: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

router.get(
  '/audit-logs',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const q = auditQuerySchema.parse(req.query);
    const result = await auditService.listAudits(q);
    return ok(res, paged(result.items, result.total, q.page ?? 1, q.pageSize ?? 20));
  }),
);

export default router;

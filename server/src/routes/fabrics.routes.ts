// src/routes/fabrics.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import * as fabricService from '../services/fabric.service.js';
import * as dictService from '../services/dict.service.js';
import { requireRole } from '../middleware/auth.js';
import { ok, paged } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const listQuerySchema = z.object({
  category: z.enum(['knit', 'woven', 'pu_suede', 'home_textile']).optional(),
  supplierId: z.string().uuid().optional(),
  season: z.string().optional(),
  garmentStyle: z.string().optional(),
  featureTag: z.string().optional(),
  weightMin: z.coerce.number().int().optional(),
  weightMax: z.coerce.number().int().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['updated_desc', 'weight_asc', 'weight_desc', 'price_asc', 'price_desc']).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const result = await fabricService.listFabrics(q);
    return ok(res, paged(result.items, result.total, q.page ?? 1, q.pageSize ?? 24));
  }),
);

router.get(
  '/_/dictionaries',
  asyncHandler(async (_req, res) => {
    const bundle = await dictService.getAllDictionaries();
    return ok(res, bundle);
  }),
);

router.get(
  '/_/dictionaries/:type',
  asyncHandler(async (req, res) => {
    const items = await dictService.getDictionary(req.params.type);
    return ok(res, items);
  }),
);

router.get(
  '/_/suppliers',
  asyncHandler(async (_req, res) => {
    const items = await dictService.listSuppliersFull();
    return ok(res, items);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const detail = await fabricService.getFabricDetail(req.params.id);
    return ok(res, detail);
  }),
);

router.get(
  '/:id/similar',
  asyncHandler(async (req, res) => {
    const list = await fabricService.getSimilarFabrics(req.params.id, 5);
    return ok(res, list);
  }),
);

export default router;

// src/services/fabric.service.ts
// Fabric CRUD + search/filter + similar fabrics.

import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { categoryLabel, fiberLabel } from '../utils/labels.js';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from '../middleware/error.js';
import type {
  FabricListItemDto,
  FabricDetailDto,
  FabricListQuery,
  FabricCompositionDto,
  FabricImageDto,
  SupplierQuoteDto,
  Category,
  FabricStatus,
  CreateFabricRequest,
} from '../types/api.js';
import type {
  FabricRow,
  FabricCompositionRow,
  FabricImageRow,
  SupplierQuoteRow,
  SupplierRow,
  CategoryRow,
  SeasonRow,
  GarmentStyleRow,
  FeatureTagRow,
  FinishRow,
} from '../types/db.js';

// ---------- mappers ----------

function compositionToLabel(comps: FabricCompositionRow[]): string | null {
  if (comps.length === 0) return null;
  return comps
    .slice(0, 3)
    .map((c) => `${fiberLabel(c.fiber_code).slice(0, 1)}${c.percentage}`)
    .join(' ');
}

function mapListItem(
  row: FabricRow & {
    supplier_name: string | null;
    supplier_brand: string | null;
    cover_url: string | null;
  },
  compositions: FabricCompositionRow[],
): FabricListItemDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    category: row.category_code,
    categoryLabel: categoryLabel(row.category_code),
    supplierName: row.supplier_name,
    supplierBrand: row.supplier_brand,
    weightGsm: row.weight_gsm,
    priceRmbPerM: row.price_rmb_per_m,
    coverImageUrl: row.cover_url,
    compositionLabel: compositionToLabel(compositions),
    sellingPoints: row.selling_points,
    status: row.status,
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}

// ---------- public read API ----------

export async function listFabrics(
  query: FabricListQuery,
): Promise<{ items: FabricListItemDto[]; total: number }> {
  const pool = await getPool();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 24));
  const offset = (page - 1) * pageSize;

  // build WHERE
  const where: string[] = ['f.is_deleted = 0', "f.status = 'active'"];
  const req = pool.request();
  req.input('offset', sql.Int, offset);
  req.input('pageSize', sql.Int, pageSize);

  if (query.category) {
    where.push('f.category_code = @category');
    req.input('category', sql.NVarChar(32), query.category);
  }
  if (query.supplierId) {
    where.push('f.supplier_id = @supplierId');
    req.input('supplierId', sql.UniqueIdentifier, query.supplierId);
  }
  if (query.weightMin != null) {
    where.push('f.weight_gsm >= @weightMin');
    req.input('weightMin', sql.Int, query.weightMin);
  }
  if (query.weightMax != null) {
    where.push('f.weight_gsm <= @weightMax');
    req.input('weightMax', sql.Int, query.weightMax);
  }
  if (query.priceMin != null) {
    where.push('f.price_rmb_per_m >= @priceMin');
    req.input('priceMin', sql.Decimal(10, 2), query.priceMin);
  }
  if (query.priceMax != null) {
    where.push('f.price_rmb_per_m <= @priceMax');
    req.input('priceMax', sql.Decimal(10, 2), query.priceMax);
  }
  if (query.q) {
    where.push(
      "(f.name LIKE @kw OR f.code LIKE @kw OR f.composition_raw LIKE @kw OR f.selling_points LIKE @kw)",
    );
    req.input('kw', sql.NVarChar(255), `%${query.q}%`);
  }

  // multi-value joins (season, garmentStyle, featureTag) — match if any overlap
  if (query.season) {
    where.push(
      'EXISTS (SELECT 1 FROM fabric_seasons fs WHERE fs.fabric_id = f.id AND fs.season_code = @season)',
    );
    req.input('season', sql.NVarChar(16), query.season);
  }
  if (query.garmentStyle) {
    where.push(
      'EXISTS (SELECT 1 FROM fabric_garment_styles gs WHERE gs.fabric_id = f.id AND gs.garment_style_code = @garmentStyle)',
    );
    req.input('garmentStyle', sql.NVarChar(32), query.garmentStyle);
  }
  if (query.featureTag) {
    where.push(
      'EXISTS (SELECT 1 FROM fabric_feature_tags ft WHERE ft.fabric_id = f.id AND ft.feature_tag_code = @featureTag)',
    );
    req.input('featureTag', sql.NVarChar(32), query.featureTag);
  }

  let orderBy = 'f.updated_at DESC, f.id';
  switch (query.sort) {
    case 'weight_asc':
      orderBy = 'f.weight_gsm ASC, f.id';
      break;
    case 'weight_desc':
      orderBy = 'f.weight_gsm DESC, f.id';
      break;
    case 'price_asc':
      orderBy = 'f.price_rmb_per_m ASC, f.id';
      break;
    case 'price_desc':
      orderBy = 'f.price_rmb_per_m DESC, f.id';
      break;
  }

  const whereClause = where.join(' AND ');

  const totalResult = await req.query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM fabrics f WHERE ${whereClause}`,
  );
  const total = totalResult.recordset[0].total;

  const rowsResult = await pool
    .request()
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize)
    .input('category', sql.NVarChar(32), query.category ?? null)
    .input('supplierId', sql.UniqueIdentifier, query.supplierId ?? null)
    .input('weightMin', sql.Int, query.weightMin ?? null)
    .input('weightMax', sql.Int, query.weightMax ?? null)
    .input('priceMin', sql.Decimal(10, 2), query.priceMin ?? null)
    .input('priceMax', sql.Decimal(10, 2), query.priceMax ?? null)
    .input('kw', sql.NVarChar(255), query.q ? `%${query.q}%` : null)
    .input('season', sql.NVarChar(16), query.season ?? null)
    .input('garmentStyle', sql.NVarChar(32), query.garmentStyle ?? null)
    .input('featureTag', sql.NVarChar(32), query.featureTag ?? null)
    .query<{
      id: string;
      name: string;
      code: string | null;
      category_code: Category;
      supplier_id: string;
      supplier_name: string | null;
      supplier_brand: string | null;
      weight_gsm: number | null;
      price_rmb_per_m: number | null;
      selling_points: string | null;
      status: FabricStatus;
      updated_at: Date | null;
      cover_url: string | null;
    }>(
      `SELECT f.id, f.name, f.code, f.category_code, f.supplier_id,
              s.name AS supplier_name, s.short_name AS supplier_brand,
              f.weight_gsm, f.price_rmb_per_m, f.selling_points, f.status, f.updated_at,
              (SELECT TOP 1 url FROM fabric_images img
                 WHERE img.fabric_id = f.id
                 ORDER BY img.is_cover DESC, img.sort_order) AS cover_url
         FROM fabrics f
         LEFT JOIN suppliers s ON s.id = f.supplier_id
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    );

  // fetch compositions in bulk
  const ids = rowsResult.recordset.map((r) => r.id);
  const compositions = await getCompositionsForFabricIds(ids);

  const items = rowsResult.recordset.map((r) => {
    const row: FabricRow & {
      supplier_name: string | null;
      supplier_brand: string | null;
      cover_url: string | null;
    } = {
      id: r.id,
      name: r.name,
      code: r.code,
      category_code: r.category_code,
      supplier_id: r.supplier_id,
      supplier_brand: r.supplier_brand,
      weight_gsm: r.weight_gsm,
      price_rmb_per_m: r.price_rmb_per_m,
      selling_points: r.selling_points,
      status: r.status,
      updated_at: r.updated_at,
      cover_url: r.cover_url,
      supplier_name: r.supplier_name,
      // fill remaining FabricRow fields with null/defaults
      composition_raw: null,
      spec_raw: null,
      weave_code: null,
      structure: null,
      finish_raw: null,
      width_cm: null,
      weight_range_min: null,
      weight_range_max: null,
      texture: null,
      color: null,
      flame_retardant: false,
      fr_standard: null,
      edge: null,
      moq: null,
      fob_usd_per_m: null,
      season_codes: null,
      recommended_style_codes: null,
      similar_fabric_ids: null,
      notes: null,
      source_file: null,
      source_row: null,
      imported_at: null,
      is_deleted: false,
      created_at: new Date(),
      created_by: null,
      updated_by: null,
    };
    return mapListItem(row, compositions.get(r.id) ?? []);
  });

  return { items, total };
}

export async function getCompositionsForFabricIds(
  ids: string[],
): Promise<Map<string, FabricCompositionRow[]>> {
  const map = new Map<string, FabricCompositionRow[]>();
  if (ids.length === 0) return map;
  const pool = await getPool();
  const req = pool.request();
  const params = ids.map((_, i) => `@id${i}`).join(',');
  ids.forEach((id, i) => req.input(`id${i}`, sql.NVarChar(32), id));
  const result = await req.query<FabricCompositionRow>(
    `SELECT fabric_id, fiber_code, percentage
       FROM fabric_compositions
      WHERE fabric_id IN (${params})`,
  );
  for (const row of result.recordset) {
    const arr = map.get(row.fabric_id) ?? [];
    arr.push(row);
    map.set(row.fabric_id, arr);
  }
  return map;
}

export async function getFabricDetail(id: string): Promise<FabricDetailDto> {
  const pool = await getPool();
  const fabricResult = await pool
    .request()
    .input('id', sql.NVarChar(32), id)
    .query<{
      id: string;
      name: string;
      code: string | null;
      category_code: Category;
      supplier_id: string;
      supplier_name: string | null;
      supplier_brand: string | null;
      composition_raw: string | null;
      spec_raw: string | null;
      weave_code: string | null;
      structure: string | null;
      finish_raw: string | null;
      width_cm: number | null;
      weight_gsm: number | null;
      weight_range_min: number | null;
      weight_range_max: number | null;
      texture: string | null;
      color: string | null;
      flame_retardant: boolean;
      fr_standard: string | null;
      edge: string | null;
      moq: string | null;
      fob_usd_per_m: number | null;
      price_rmb_per_m: number | null;
      selling_points: string | null;
      notes: string | null;
      status: FabricStatus;
      updated_at: Date | null;
      cover_url: string | null;
    }>(
      `SELECT f.id, f.name, f.code, f.category_code, f.supplier_id, f.supplier_brand,
              s.name AS supplier_name,
              f.composition_raw, f.spec_raw, f.weave_code, f.structure, f.finish_raw,
              f.width_cm, f.weight_gsm, f.weight_range_min, f.weight_range_max,
              f.texture, f.color, f.flame_retardant, f.fr_standard, f.edge,
              f.moq, f.fob_usd_per_m, f.price_rmb_per_m,
              f.selling_points, f.notes, f.status, f.updated_at,
              (SELECT TOP 1 url FROM fabric_images img
                 WHERE img.fabric_id = f.id
                 ORDER BY img.is_cover DESC, img.sort_order) AS cover_url
         FROM fabrics f
         LEFT JOIN suppliers s ON s.id = f.supplier_id
        WHERE f.id = @id AND f.is_deleted = 0`,
    );
  const row = fabricResult.recordset[0];
  if (!row) throw new NotFoundError('面料不存在');

  const [compositions, images, seasons, styles, tags, finishes, quotes, similar] =
    await Promise.all([
      getCompositionsForFabricIds([id]).then((m) => m.get(id) ?? []),
      getImagesForFabric(id),
      getFabricSeasons(id),
      getFabricGarmentStyles(id),
      getFabricFeatureTags(id),
      getFabricFinishes(id),
      getSupplierQuotes(id),
      getSimilarFabrics(id, 5),
    ]);

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    category: row.category_code,
    categoryLabel: categoryLabel(row.category_code),
    supplierName: row.supplier_name,
    supplierBrand: row.supplier_brand ?? row.supplier_name,
    weightGsm: row.weight_gsm,
    priceRmbPerM: row.price_rmb_per_m,
    coverImageUrl: row.cover_url,
    compositionLabel: compositionToLabel(compositions),
    sellingPoints: row.selling_points,
    status: row.status,
    updatedAt: row.updated_at?.toISOString() ?? null,
    compositionRaw: row.composition_raw,
    specRaw: row.spec_raw,
    structure: row.structure,
    finishRaw: row.finish_raw,
    widthCm: row.width_cm,
    weightRangeMin: row.weight_range_min,
    weightRangeMax: row.weight_range_max,
    texture: row.texture,
    color: row.color,
    flameRetardant: row.flame_retardant,
    frStandard: row.fr_standard,
    edge: row.edge,
    moq: row.moq,
    fobUsdPerM: row.fob_usd_per_m,
    notes: row.notes,
    compositions: compositions.map<FabricCompositionDto>((c) => ({
      fiberCode: c.fiber_code,
      fiberLabel: fiberLabel(c.fiber_code),
      percentage: c.percentage,
    })),
    images,
    seasons,
    garmentStyles: styles,
    featureTags: tags,
    finishes,
    supplierQuotes: quotes,
    similarFabrics: similar,
  };
}

async function getImagesForFabric(fabricId: string): Promise<FabricImageDto[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('fabricId', sql.NVarChar(32), fabricId)
    .query<FabricImageRow>(
      `SELECT id, fabric_id, url, alt, sort_order, is_cover, source, sha1_8, created_at
         FROM fabric_images
        WHERE fabric_id = @fabricId
        ORDER BY is_cover DESC, sort_order`,
    );
  return result.recordset.map((r) => ({
    id: r.id,
    url: r.url,
    fullUrl: r.url, // frontend prepends API base
    alt: r.alt,
    isCover: r.is_cover,
    sortOrder: r.sort_order,
  }));
}

async function getFabricSeasons(
  fabricId: string,
): Promise<{ code: string; label: string }[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('fabricId', sql.NVarChar(32), fabricId)
    .query<{ code: string; name_zh: string }>(
      `SELECT s.code, s.name_zh
         FROM fabric_seasons fs
         JOIN seasons s ON s.code = fs.season_code
        WHERE fs.fabric_id = @fabricId
        ORDER BY s.sort_order`,
    );
  return result.recordset.map((r) => ({ code: r.code, label: r.name_zh }));
}

async function getFabricGarmentStyles(
  fabricId: string,
): Promise<{ code: string; label: string }[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('fabricId', sql.NVarChar(32), fabricId)
    .query<{ code: string; name_zh: string }>(
      `SELECT gs.code, gs.name_zh
         FROM fabric_garment_styles fgs
         JOIN garment_styles gs ON gs.code = fgs.garment_style_code
        WHERE fgs.fabric_id = @fabricId
        ORDER BY gs.sort_order`,
    );
  return result.recordset.map((r) => ({ code: r.code, label: r.name_zh }));
}

async function getFabricFeatureTags(
  fabricId: string,
): Promise<{ code: string; label: string }[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('fabricId', sql.NVarChar(32), fabricId)
    .query<{ code: string; name_zh: string }>(
      `SELECT ft.code, ft.name_zh
         FROM fabric_feature_tags fft
         JOIN feature_tags ft ON ft.code = fft.feature_tag_code
        WHERE fft.fabric_id = @fabricId
        ORDER BY ft.sort_order`,
    );
  return result.recordset.map((r) => ({ code: r.code, label: r.name_zh }));
}

async function getFabricFinishes(
  fabricId: string,
): Promise<{ code: string; label: string }[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('fabricId', sql.NVarChar(32), fabricId)
    .query<{ code: string; name_zh: string }>(
      `SELECT fi.code, fi.name_zh
         FROM fabric_finishes ff
         JOIN finishes fi ON fi.code = ff.finish_code
        WHERE ff.fabric_id = @fabricId
        ORDER BY fi.sort_order`,
    );
  return result.recordset.map((r) => ({ code: r.code, label: r.name_zh }));
}

async function getSupplierQuotes(fabricId: string): Promise<SupplierQuoteDto[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('fabricId', sql.NVarChar(32), fabricId)
    .query<SupplierQuoteRow>(
      `SELECT id, fabric_id, supplier_name, price_rmb_per_m, moq, phone, email, sort_order
         FROM supplier_quotes
        WHERE fabric_id = @fabricId
        ORDER BY sort_order`,
    );
  return result.recordset.map((r) => ({
    id: r.id,
    supplierName: r.supplier_name,
    priceRmbPerM: r.price_rmb_per_m,
    moq: r.moq,
    phone: r.phone,
    email: r.email,
  }));
}

export async function getSimilarFabrics(
  fabricId: string,
  limit = 5,
): Promise<FabricListItemDto[]> {
  const pool = await getPool();
  const targetResult = await pool
    .request()
    .input('id', sql.NVarChar(32), fabricId)
    .query<{ weight_gsm: number | null; category_code: Category }>(
      `SELECT weight_gsm, category_code FROM fabrics WHERE id = @id AND is_deleted = 0`,
    );
  const target = targetResult.recordset[0];
  if (!target) return [];

  // same category, weight within ±20%; prefer those sharing a style/tag/season
  const similarResult = await pool
    .request()
    .input('id', sql.NVarChar(32), fabricId)
    .input('category', sql.NVarChar(32), target.category_code)
    .input('weight', sql.Int, target.weight_gsm ?? 0)
    .input('limit', sql.Int, limit)
    .query<{
      id: string;
      name: string;
      code: string | null;
      category_code: Category;
      supplier_id: string;
      supplier_name: string | null;
      supplier_brand: string | null;
      weight_gsm: number | null;
      price_rmb_per_m: number | null;
      selling_points: string | null;
      status: FabricStatus;
      updated_at: Date | null;
      cover_url: string | null;
    }>(
      `SELECT TOP (@limit) f.id, f.name, f.code, f.category_code, f.supplier_id,
              s.name AS supplier_name, s.short_name AS supplier_brand,
              f.weight_gsm, f.price_rmb_per_m, f.selling_points, f.status, f.updated_at,
              (SELECT TOP 1 url FROM fabric_images img
                 WHERE img.fabric_id = f.id
                 ORDER BY img.is_cover DESC, img.sort_order) AS cover_url,
              ABS(f.weight_gsm - @weight) AS weight_diff,
              (CASE WHEN EXISTS (SELECT 1 FROM fabric_garment_styles gs1
                                   JOIN fabric_garment_styles gs2 ON gs1.garment_style_code = gs2.garment_style_code
                                  WHERE gs1.fabric_id = @id AND gs2.fabric_id = f.id) THEN 1 ELSE 0 END
               + CASE WHEN EXISTS (SELECT 1 FROM fabric_feature_tags ft1
                                      JOIN fabric_feature_tags ft2 ON ft1.feature_tag_code = ft2.feature_tag_code
                                     WHERE ft1.fabric_id = @id AND ft2.fabric_id = f.id) THEN 1 ELSE 0 END
               + CASE WHEN EXISTS (SELECT 1 FROM fabric_seasons fs1
                                      JOIN fabric_seasons fs2 ON fs1.season_code = fs2.season_code
                                     WHERE fs1.fabric_id = @id AND fs2.fabric_id = f.id) THEN 1 ELSE 0 END
              ) AS shared_attrs
         FROM fabrics f
         LEFT JOIN suppliers s ON s.id = f.supplier_id
        WHERE f.is_deleted = 0
          AND f.status = 'active'
          AND f.id <> @id
          AND f.category_code = @category
          AND f.weight_gsm IS NOT NULL
          AND ABS(f.weight_gsm - @weight) <= @weight * 0.2
        ORDER BY shared_attrs DESC, weight_diff ASC`,
    );
  if (similarResult.recordset.length === 0) return [];
  const ids = similarResult.recordset.map((r) => r.id);
  const compositions = await getCompositionsForFabricIds(ids);
  return similarResult.recordset.map((r) => {
    const row: FabricRow & {
      supplier_name: string | null;
      supplier_brand: string | null;
      cover_url: string | null;
    } = {
      id: r.id,
      name: r.name,
      code: r.code,
      category_code: r.category_code,
      supplier_name: r.supplier_name,
      supplier_id: r.supplier_id,
      supplier_brand: r.supplier_brand,
      weight_gsm: r.weight_gsm,
      price_rmb_per_m: r.price_rmb_per_m,
      selling_points: r.selling_points,
      status: r.status,
      updated_at: r.updated_at,
      cover_url: r.cover_url,
      composition_raw: null, spec_raw: null, weave_code: null, structure: null,
      finish_raw: null, width_cm: null, weight_range_min: null, weight_range_max: null,
      texture: null, color: null, flame_retardant: false, fr_standard: null, edge: null,
      moq: null, fob_usd_per_m: null, season_codes: null, recommended_style_codes: null,
      similar_fabric_ids: null, notes: null, source_file: null, source_row: null,
      imported_at: null, is_deleted: false, created_at: new Date(),
      created_by: null, updated_by: null,
    };
    return mapListItem(row, compositions.get(r.id) ?? []);
  });
}

// ---------- admin CRUD ----------

export async function adminListFabrics(
  query: FabricListQuery & { status?: FabricStatus; includeDeleted?: boolean },
): Promise<{ items: FabricListItemDto[]; total: number }> {
  const pool = await getPool();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 24));
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  if (!query.includeDeleted) where.push('f.is_deleted = 0');
  if (query.status) {
    where.push('f.status = @status');
  }
  if (query.category) where.push('f.category_code = @category');
  if (query.q) where.push('(f.name LIKE @kw OR f.code LIKE @kw)');
  const whereClause = where.length > 0 ? where.join(' AND ') : '1=1';

  const totalResult = await pool
    .request()
    .input('status', sql.NVarChar(16), query.status ?? null)
    .input('category', sql.NVarChar(32), query.category ?? null)
    .input('kw', sql.NVarChar(255), query.q ? `%${query.q}%` : null)
    .query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM fabrics f WHERE ${whereClause}`,
    );

  const rowsResult = await pool
    .request()
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize)
    .input('status', sql.NVarChar(16), query.status ?? null)
    .input('category', sql.NVarChar(32), query.category ?? null)
    .input('kw', sql.NVarChar(255), query.q ? `%${query.q}%` : null)
    .query<{
      id: string;
      name: string;
      code: string | null;
      category_code: Category;
      supplier_id: string;
      supplier_name: string | null;
      supplier_brand: string | null;
      weight_gsm: number | null;
      price_rmb_per_m: number | null;
      selling_points: string | null;
      status: FabricStatus;
      updated_at: Date | null;
      cover_url: string | null;
    }>(
      `SELECT f.id, f.name, f.code, f.category_code, f.supplier_id,
              s.name AS supplier_name, s.short_name AS supplier_brand,
              f.weight_gsm, f.price_rmb_per_m, f.selling_points, f.status, f.updated_at,
              (SELECT TOP 1 url FROM fabric_images img
                 WHERE img.fabric_id = f.id
                 ORDER BY img.is_cover DESC, img.sort_order) AS cover_url
         FROM fabrics f
         LEFT JOIN suppliers s ON s.id = f.supplier_id
        WHERE ${whereClause}
        ORDER BY f.updated_at DESC, f.id
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    );
  const ids = rowsResult.recordset.map((r) => r.id);
  const compositions = await getCompositionsForFabricIds(ids);
  const items = rowsResult.recordset.map((r) => {
    const row: FabricRow & {
      supplier_name: string | null;
      supplier_brand: string | null;
      cover_url: string | null;
    } = {
      id: r.id, name: r.name, code: r.code, category_code: r.category_code,
      supplier_id: r.supplier_id, supplier_brand: r.supplier_brand,
      weight_gsm: r.weight_gsm, price_rmb_per_m: r.price_rmb_per_m,
      selling_points: r.selling_points, status: r.status, updated_at: r.updated_at,
      cover_url: r.cover_url,
      supplier_name: r.supplier_name,
      composition_raw: null, spec_raw: null, weave_code: null, structure: null,
      finish_raw: null, width_cm: null, weight_range_min: null, weight_range_max: null,
      texture: null, color: null, flame_retardant: false, fr_standard: null, edge: null,
      moq: null, fob_usd_per_m: null, season_codes: null, recommended_style_codes: null,
      similar_fabric_ids: null, notes: null, source_file: null, source_row: null,
      imported_at: null, is_deleted: false, created_at: new Date(),
      created_by: null, updated_by: null,
    };
    return mapListItem(row, compositions.get(r.id) ?? []);
  });
  return { items, total: totalResult.recordset[0].total };
}

export async function adminCreateFabric(
  input: CreateFabricRequest,
  createdBy: string,
): Promise<string> {
  const pool = await getPool();
  const id = await generateFabricId(input.name, input.code ?? null);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await tx
      .request()
      .input('id', sql.NVarChar(32), id)
      .input('code', sql.NVarChar(64), input.code ?? null)
      .input('name', sql.NVarChar(128), input.name)
      .input('category', sql.NVarChar(32), input.category)
      .input('supplierId', sql.UniqueIdentifier, input.supplierId)
      .input('supplierBrand', sql.NVarChar(64), input.supplierBrand ?? null)
      .input('compositionRaw', sql.NVarChar(255), input.compositionRaw ?? null)
      .input('specRaw', sql.NVarChar(64), input.specRaw ?? null)
      .input('widthCm', sql.Int, input.widthCm ?? null)
      .input('weightGsm', sql.Int, input.weightGsm ?? null)
      .input('weightRangeMin', sql.Int, input.weightRangeMin ?? null)
      .input('weightRangeMax', sql.Int, input.weightRangeMax ?? null)
      .input('structure', sql.NVarChar(64), input.structure ?? null)
      .input('finishRaw', sql.NVarChar(64), input.finishRaw ?? null)
      .input('texture', sql.NVarChar(64), input.texture ?? null)
      .input('color', sql.NVarChar(64), input.color ?? null)
      .input('flameRetardant', sql.Bit, input.flameRetardant ?? false)
      .input('frStandard', sql.NVarChar(64), input.frStandard ?? null)
      .input('edge', sql.NVarChar(64), input.edge ?? null)
      .input('moq', sql.NVarChar(32), input.moq ?? null)
      .input('fobUsdPerM', sql.Decimal(10, 2), input.fobUsdPerM ?? null)
      .input('priceRmbPerM', sql.Decimal(10, 2), input.priceRmbPerM ?? null)
      .input('sellingPoints', sql.NVarChar(sql.MAX), input.sellingPoints ?? null)
      .input('notes', sql.NVarChar(sql.MAX), input.notes ?? null)
      .input('status', sql.NVarChar(16), input.status ?? 'active')
      .input('createdBy', sql.NVarChar(64), createdBy)
      .query(
        `INSERT INTO fabrics
           (id, code, name, category_code, supplier_id, supplier_brand,
            composition_raw, spec_raw, width_cm, weight_gsm, weight_range_min, weight_range_max,
            structure, finish_raw, texture, color, flame_retardant, fr_standard, edge,
            moq, fob_usd_per_m, price_rmb_per_m,
            selling_points, notes, status, created_by)
         VALUES
           (@id, @code, @name, @category, @supplierId, @supplierBrand,
            @compositionRaw, @specRaw, @widthCm, @weightGsm, @weightRangeMin, @weightRangeMax,
            @structure, @finishRaw, @texture, @color, @flameRetardant, @frStandard, @edge,
            @moq, @fobUsdPerM, @priceRmbPerM,
            @sellingPoints, @notes, @status, @createdBy)`,
      );
    await insertFabricRelations(tx, id, input);
    await tx.commit();
    return id;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function adminUpdateFabric(
  id: string,
  input: CreateFabricRequest,
  updatedBy: string,
): Promise<void> {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('id', sql.NVarChar(32), id)
    .query<{ id: string }>(
      `SELECT id FROM fabrics WHERE id = @id AND is_deleted = 0`,
    );
  if (existing.recordset.length === 0) throw new NotFoundError('面料不存在');

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await tx
      .request()
      .input('id', sql.NVarChar(32), id)
      .input('code', sql.NVarChar(64), input.code ?? null)
      .input('name', sql.NVarChar(128), input.name)
      .input('category', sql.NVarChar(32), input.category)
      .input('supplierId', sql.UniqueIdentifier, input.supplierId)
      .input('supplierBrand', sql.NVarChar(64), input.supplierBrand ?? null)
      .input('compositionRaw', sql.NVarChar(255), input.compositionRaw ?? null)
      .input('specRaw', sql.NVarChar(64), input.specRaw ?? null)
      .input('widthCm', sql.Int, input.widthCm ?? null)
      .input('weightGsm', sql.Int, input.weightGsm ?? null)
      .input('weightRangeMin', sql.Int, input.weightRangeMin ?? null)
      .input('weightRangeMax', sql.Int, input.weightRangeMax ?? null)
      .input('structure', sql.NVarChar(64), input.structure ?? null)
      .input('finishRaw', sql.NVarChar(64), input.finishRaw ?? null)
      .input('texture', sql.NVarChar(64), input.texture ?? null)
      .input('color', sql.NVarChar(64), input.color ?? null)
      .input('flameRetardant', sql.Bit, input.flameRetardant ?? false)
      .input('frStandard', sql.NVarChar(64), input.frStandard ?? null)
      .input('edge', sql.NVarChar(64), input.edge ?? null)
      .input('moq', sql.NVarChar(32), input.moq ?? null)
      .input('fobUsdPerM', sql.Decimal(10, 2), input.fobUsdPerM ?? null)
      .input('priceRmbPerM', sql.Decimal(10, 2), input.priceRmbPerM ?? null)
      .input('sellingPoints', sql.NVarChar(sql.MAX), input.sellingPoints ?? null)
      .input('notes', sql.NVarChar(sql.MAX), input.notes ?? null)
      .input('status', sql.NVarChar(16), input.status ?? 'active')
      .input('updatedBy', sql.NVarChar(64), updatedBy)
      .query(
        `UPDATE fabrics SET
            code = @code,
            name = @name,
            category_code = @category,
            supplier_id = @supplierId,
            supplier_brand = @supplierBrand,
            composition_raw = @compositionRaw,
            spec_raw = @specRaw,
            width_cm = @widthCm,
            weight_gsm = @weightGsm,
            weight_range_min = @weightRangeMin,
            weight_range_max = @weightRangeMax,
            structure = @structure,
            finish_raw = @finishRaw,
            texture = @texture,
            color = @color,
            flame_retardant = @flameRetardant,
            fr_standard = @frStandard,
            edge = @edge,
            moq = @moq,
            fob_usd_per_m = @fobUsdPerM,
            price_rmb_per_m = @priceRmbPerM,
            selling_points = @sellingPoints,
            notes = @notes,
            status = @status,
            updated_by = @updatedBy,
            updated_at = SYSUTCDATETIME()
          WHERE id = @id`,
      );
    // wipe + re-insert relations
    await tx
      .request()
      .input('id', sql.NVarChar(32), id)
      .query('DELETE FROM fabric_compositions WHERE fabric_id = @id');
    await tx
      .request()
      .input('id', sql.NVarChar(32), id)
      .query('DELETE FROM fabric_seasons WHERE fabric_id = @id');
    await tx
      .request()
      .input('id', sql.NVarChar(32), id)
      .query('DELETE FROM fabric_garment_styles WHERE fabric_id = @id');
    await tx
      .request()
      .input('id', sql.NVarChar(32), id)
      .query('DELETE FROM fabric_feature_tags WHERE fabric_id = @id');
    await tx
      .request()
      .input('id', sql.NVarChar(32), id)
      .query('DELETE FROM fabric_finishes WHERE fabric_id = @id');
    await insertFabricRelations(tx, id, input);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function adminDeleteFabric(id: string, deletedBy: string): Promise<void> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.NVarChar(32), id)
    .input('deletedBy', sql.NVarChar(64), deletedBy)
    .query(
      `UPDATE fabrics SET is_deleted = 1, updated_at = SYSUTCDATETIME(), updated_by = @deletedBy
        WHERE id = @id AND is_deleted = 0`,
    );
  if (result.rowsAffected[0] === 0) throw new NotFoundError('面料不存在');
}

export async function adminChangeStatus(
  id: string,
  status: FabricStatus,
  updatedBy: string,
): Promise<void> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.NVarChar(32), id)
    .input('status', sql.NVarChar(16), status)
    .input('updatedBy', sql.NVarChar(64), updatedBy)
    .query(
      `UPDATE fabrics SET status = @status, updated_at = SYSUTCDATETIME(), updated_by = @updatedBy
        WHERE id = @id AND is_deleted = 0`,
    );
  if (result.rowsAffected[0] === 0) throw new NotFoundError('面料不存在');
}

async function insertFabricRelations(
  tx: sql.Transaction,
  fabricId: string,
  input: CreateFabricRequest,
): Promise<void> {
  if (input.compositions && input.compositions.length > 0) {
    const req = tx.request();
    req.input('fabricId', sql.NVarChar(32), fabricId);
    const values = input.compositions
      .map((_, i) => `(@fabricId, @f${i}, @p${i})`)
      .join(', ');
    input.compositions.forEach((c, i) => {
      req.input(`f${i}`, sql.NVarChar(32), c.fiberCode);
      req.input(`p${i}`, sql.Decimal(5, 2), c.percentage);
    });
    await req.query(
      `INSERT INTO fabric_compositions (fabric_id, fiber_code, percentage) VALUES ${values}`,
    );
  }
  await insertMany(tx, fabricId, input.seasons, 'fabric_seasons', 'season_code');
  await insertMany(tx, fabricId, input.garmentStyles, 'fabric_garment_styles', 'garment_style_code');
  await insertMany(tx, fabricId, input.featureTags, 'fabric_feature_tags', 'feature_tag_code');
  await insertMany(tx, fabricId, input.finishes, 'fabric_finishes', 'finish_code');
}

async function insertMany(
  tx: sql.Transaction,
  fabricId: string,
  codes: string[] | undefined,
  table: string,
  col: string,
): Promise<void> {
  if (!codes || codes.length === 0) return;
  const req = tx.request();
  req.input('fabricId', sql.NVarChar(32), fabricId);
  const values = codes.map((_, i) => `(@fabricId, @c${i})`).join(', ');
  codes.forEach((c, i) => req.input(`c${i}`, sql.NVarChar(32), c));
  await req.query(
    `INSERT INTO ${table} (fabric_id, ${col}) VALUES ${values}`,
  );
}

async function generateFabricId(name: string, code: string | null): Promise<string> {
  // 12-char prefix of md5(code|name) — match extract_fabrics.py convention
  const crypto = await import('node:crypto');
  const seed = `${code ?? ''}|${name}`;
  return crypto.createHash('md5').update(seed).digest('hex').slice(0, 12);
}

// ---------- image CRUD ----------

export async function adminAddImage(
  fabricId: string,
  input: { url: string; alt?: string; sortOrder?: number; isCover?: boolean; source?: 'archive' | 'uploaded' },
): Promise<string> {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('id', sql.NVarChar(32), fabricId)
    .query<{ id: string }>('SELECT id FROM fabrics WHERE id = @id AND is_deleted = 0');
  if (existing.recordset.length === 0) throw new NotFoundError('面料不存在');

  if (input.isCover) {
    await pool
      .request()
      .input('fabricId', sql.NVarChar(32), fabricId)
      .query('UPDATE fabric_images SET is_cover = 0 WHERE fabric_id = @fabricId');
  }
  const result = await pool
    .request()
    .input('fabricId', sql.NVarChar(32), fabricId)
    .input('url', sql.NVarChar(512), input.url)
    .input('alt', sql.NVarChar(128), input.alt ?? null)
    .input('sortOrder', sql.Int, input.sortOrder ?? 0)
    .input('isCover', sql.Bit, input.isCover ?? false)
    .input('source', sql.NVarChar(16), input.source ?? 'uploaded')
    .query<{ id: string }>(
      `INSERT INTO fabric_images (fabric_id, url, alt, sort_order, is_cover, source)
       OUTPUT INSERTED.id AS id
       VALUES (@fabricId, @url, @alt, @sortOrder, @isCover, @source)`,
    );
  return result.recordset[0].id;
}

export async function adminDeleteImage(fabricId: string, imageId: string): Promise<void> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('imageId', sql.UniqueIdentifier, imageId)
    .input('fabricId', sql.NVarChar(32), fabricId)
    .query('DELETE FROM fabric_images WHERE id = @imageId AND fabric_id = @fabricId');
  if (result.rowsAffected[0] === 0) throw new NotFoundError('图片不存在');
}

export async function adminSetCoverImage(fabricId: string, imageId: string): Promise<void> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await tx
      .request()
      .input('fabricId', sql.NVarChar(32), fabricId)
      .query('UPDATE fabric_images SET is_cover = 0 WHERE fabric_id = @fabricId');
    const result = await tx
      .request()
      .input('imageId', sql.UniqueIdentifier, imageId)
      .input('fabricId', sql.NVarChar(32), fabricId)
      .query(
        'UPDATE fabric_images SET is_cover = 1 WHERE id = @imageId AND fabric_id = @fabricId',
      );
    if (result.rowsAffected[0] === 0) {
      await tx.rollback();
      throw new NotFoundError('图片不存在');
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------- dashboard stats ----------

export async function getDashboardStats(): Promise<{
  totalFabrics: number;
  activeFabrics: number;
  draftFabrics: number;
  inactiveFabrics: number;
  totalSuppliers: number;
  totalUsers: number;
  newLast7Days: number;
  recentAudits: {
    id: number;
    username: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
  }[];
}> {
  const pool = await getPool();
  const counts = await pool.request().query<{
    total: number; active: number; draft: number; inactive: number;
    suppliers: number; users: number; new7: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM fabrics WHERE is_deleted = 0) AS total,
       (SELECT COUNT(*) FROM fabrics WHERE is_deleted = 0 AND status = 'active') AS active,
       (SELECT COUNT(*) FROM fabrics WHERE is_deleted = 0 AND status = 'draft') AS draft,
       (SELECT COUNT(*) FROM fabrics WHERE is_deleted = 0 AND status = 'inactive') AS inactive,
       (SELECT COUNT(*) FROM suppliers WHERE is_active = 1) AS suppliers,
       (SELECT COUNT(*) FROM users WHERE is_active = 1) AS users,
       (SELECT COUNT(*) FROM fabrics WHERE is_deleted = 0 AND created_at >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS new7`,
  );
  const audits = await pool.request().query<{
    id: number; username: string | null; action: string;
    entity_type: string; entity_id: string | null; created_at: Date;
  }>(
    `SELECT TOP 10 id, username, action, entity_type, entity_id, created_at
       FROM audit_logs
       ORDER BY created_at DESC`,
  );
  return {
    totalFabrics: counts.recordset[0].total,
    activeFabrics: counts.recordset[0].active,
    draftFabrics: counts.recordset[0].draft,
    inactiveFabrics: counts.recordset[0].inactive,
    totalSuppliers: counts.recordset[0].suppliers,
    totalUsers: counts.recordset[0].users,
    newLast7Days: counts.recordset[0].new7,
    recentAudits: audits.recordset.map((r) => ({
      id: r.id,
      username: r.username,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      createdAt: r.created_at.toISOString(),
    })),
  };
}

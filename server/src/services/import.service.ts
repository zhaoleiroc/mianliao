// src/services/import.service.ts
// Bulk import CSV/XLSX — fabric upsert from the 25-column 钉钉 table template.

import sql from 'mssql';
import crypto from 'node:crypto';
import { parse as csvParse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { getPool } from '../db/pool.js';
import type { ImportErrorRow, ImportResultDto } from '../types/api.js';

interface ParsedRow {
  rowNum: number;
  raw: Record<string, string>;
}

const REQUIRED_FIELDS = ['name', 'category', 'supplier'] as const;

/** 钉钉 25 列 → 内部字段映射 */
const FIELD_MAP: Record<string, string> = {
  面料编号: 'code',
  面料名称: 'name',
  品类: 'category',
  供应商: 'supplier',
  成分描述: 'composition_raw',
  涤纶: 'polyester',
  棉: 'cotton',
  氨纶: 'spandex',
  再生纤维: 'recycled_pct',
  其他成分: 'composition_other',
  幅宽: 'width_cm',
  克重: 'weight_gsm',
  结构: 'structure',
  后整理: 'finish_raw',
  阻燃等级: 'fr_standard',
  RMB价格: 'price_rmb_per_m',
  FOB价格: 'fob_usd_per_m',
  起订量: 'moq',
  适用季节: 'seasons',
  推荐款式: 'garment_styles',
  特性标签: 'feature_tags',
  卖点文案: 'selling_points',
  备注: 'notes',
  来源文件: 'source_file',
  来源行号: 'source_row',
};

const KNOWN_CATEGORIES = ['knit', 'woven', 'pu_suede', 'home_textile'];

// CSV may use either English codes or Chinese labels; normalize both to the English code.
const CATEGORY_ALIAS: Record<string, string> = {
  针织: 'knit',
  化纤梭织: 'woven',
  机织: 'woven',
  梭织: 'woven',
  'PU 麂皮': 'pu_suede',
  'PU麂皮': 'pu_suede',
  'PU 绒': 'pu_suede',
  'PU绒': 'pu_suede',
  麂皮: 'pu_suede',
  家纺: 'home_textile',
  家纺阻燃: 'home_textile',
  阻燃: 'home_textile',
};

// Season label → code
const SEASON_ALIAS: Record<string, string> = {
  春: 'spring', 夏季: 'summer', 夏: 'summer', 秋: 'fall', 冬: 'winter', 四季: 'all', 春夏: 'summer',
};

// Garment style label → code
const STYLE_ALIAS: Record<string, string> = {
  外套: '外套', T恤: 'T恤', 卫衣: '卫衣', 衬衫: '衬衫', 夹克: '夹克',
  '夹克/夹棉': '夹克', 家居服: '家居服', 运动服: '运动服', 童装: '童装', 内裤: '内裤',
  床品: '床品', 家纺床品: '床品', 窗帘: '窗帘', 家纺窗帘: '窗帘',
  马甲: '马甲', 工装裤: '工装裤', 'Polo衫': 'Polo衫', 'Polo 衫': 'Polo衫',
};

// Feature tag label → code
const TAG_ALIAS: Record<string, string> = {
  保暖: '保暖', 透气: '透气', 弹力: '弹力', 亲肤: '亲肤', 挺括: '挺括', 垂感: '垂感',
  抗皱: '抗皱', 抗起球: '抗起球', 防水: '防水', 阻燃: '阻燃', 再生环保: '再生环保', 复古: '复古',
};

interface InternalRow {
  code: string | null;
  name: string;
  category: string;
  supplierName: string;
  compositionRaw: string | null;
  fiberPercents: { fiber: string; pct: number }[];
  compositionOther: string | null;
  widthCm: number | null;
  weightGsm: number | null;
  structure: string | null;
  finishRaw: string | null;
  frStandard: string | null;
  priceRmbPerM: number | null;
  fobUsdPerM: number | null;
  moq: string | null;
  seasons: string[];
  garmentStyles: string[];
  featureTags: string[];
  sellingPoints: string | null;
  notes: string | null;
  sourceFile: string | null;
  sourceRow: number | null;
}

function parseNumberOrNull(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function splitMulti(v: string | undefined): string[] {
  if (!v) return [];
  return v.split(/[;；,，]/).map((s) => s.trim()).filter(Boolean);
}

function mapSeason(s: string): string { return SEASON_ALIAS[s] ?? s; }
function mapStyle(s: string): string { return STYLE_ALIAS[s] ?? s; }
function mapTag(s: string): string { return TAG_ALIAS[s] ?? s; }

function toInternal(rowNum: number, raw: Record<string, string>, errors: ImportErrorRow[]): InternalRow | null {
  const mapped: Record<string, string> = {};
  for (const [zh, en] of Object.entries(FIELD_MAP)) {
    if (raw[zh] != null && raw[zh] !== '') mapped[en] = raw[zh].trim();
  }
  // Required field validation
  for (const f of REQUIRED_FIELDS) {
    if (!mapped[f]) {
      errors.push({ row: rowNum, field: f, message: `缺少必填字段 ${f}` });
      return null;
    }
  }
  // Category enum (CSV may use Chinese label or English code; normalize)
  let category = mapped.category;
  if (CATEGORY_ALIAS[category]) category = CATEGORY_ALIAS[category];
  if (!KNOWN_CATEGORIES.includes(category)) {
    errors.push({ row: rowNum, field: 'category', message: `未知品类: ${mapped.category}` });
    return null;
  }
  // Compositions
  const fiberPercents: { fiber: string; pct: number }[] = [];
  for (const [fiber, key] of [
    ['polyester', 'polyester'],
    ['cotton', 'cotton'],
    ['spandex', 'spandex'],
    ['recycled_polyester', 'recycled_pct'],
  ] as const) {
    const pct = parseNumberOrNull(mapped[key]);
    if (pct != null && pct > 0) {
      fiberPercents.push({ fiber, pct });
    }
  }
  return {
    code: mapped.code ?? null,
    name: mapped.name,
    category,
    supplierName: mapped.supplier,
    compositionRaw: mapped.composition_raw ?? null,
    fiberPercents,
    compositionOther: mapped.composition_other ?? null,
    widthCm: parseNumberOrNull(mapped.width_cm),
    weightGsm: parseNumberOrNull(mapped.weight_gsm),
    structure: mapped.structure ?? null,
    finishRaw: mapped.finish_raw ?? null,
    frStandard: mapped.fr_standard ?? null,
    priceRmbPerM: parseNumberOrNull(mapped.price_rmb_per_m),
    fobUsdPerM: parseNumberOrNull(mapped.fob_usd_per_m),
    moq: mapped.moq ?? null,
    seasons: splitMulti(mapped.seasons).map(mapSeason),
    garmentStyles: splitMulti(mapped.garment_styles).map(mapStyle),
    featureTags: splitMulti(mapped.feature_tags).map(mapTag),
    sellingPoints: mapped.selling_points ?? null,
    notes: mapped.notes ?? null,
    sourceFile: mapped.source_file ?? null,
    sourceRow: parseNumberOrNull(mapped.source_row),
  };
}

function generateId(name: string, code: string | null): string {
  return crypto.createHash('md5').update(`${code ?? ''}|${name}`).digest('hex').slice(0, 12);
}

async function ensureSupplierId(pool: sql.ConnectionPool, name: string): Promise<string> {
  const found = await pool
    .request()
    .input('name', sql.NVarChar(128), name)
    .query<{ id: string }>('SELECT id FROM suppliers WHERE name = @name');
  if (found.recordset[0]) return found.recordset[0].id;
  const inserted = await pool
    .request()
    .input('name', sql.NVarChar(128), name)
    .input('shortName', sql.NVarChar(32), null)
    .query<{ id: string }>(
      `INSERT INTO suppliers (name) OUTPUT INSERTED.id AS id VALUES (@name)`,
    );
  return inserted.recordset[0].id;
}

function parseCSV(buffer: Buffer): ParsedRow[] {
  const records = csvParse(buffer, {
    columns: (header) => header.map((h: string) => h.replace(/^﻿/, '').trim()),
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  return records.map((r, i) => ({ rowNum: i + 2, raw: r })); // +2 = header row + 1-based
}

function parseXLSX(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
  return records.map((r, i) => ({ rowNum: i + 2, raw: r }));
}

export async function importFabrics(
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  userId: string | null,
): Promise<ImportResultDto> {
  const start = Date.now();
  const errors: ImportErrorRow[] = [];
  let parsed: ParsedRow[] = [];
  try {
    if (file.mimetype.includes('csv') || file.originalname.toLowerCase().endsWith('.csv')) {
      parsed = parseCSV(file.buffer);
    } else if (
      file.mimetype.includes('sheet') ||
      file.mimetype.includes('excel') ||
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls')
    ) {
      parsed = parseXLSX(file.buffer);
    } else {
      throw new Error(`不支持的文件类型: ${file.mimetype}`);
    }
  } catch (err: any) {
    errors.push({ row: 0, message: `文件解析失败: ${err.message ?? String(err)}` });
    return await saveBatchAndReturn(file, [], errors, userId, start);
  }

  if (parsed.length === 0) {
    errors.push({ row: 0, message: '文件为空' });
    return await saveBatchAndReturn(file, [], errors, userId, start);
  }

  // First pass: validate
  const valid: InternalRow[] = [];
  for (const p of parsed) {
    const row = toInternal(p.rowNum, p.raw, errors);
    if (row) valid.push(row);
  }
  if (valid.length === 0) {
    return await saveBatchAndReturn(file, [], errors, userId, start);
  }

  // Second pass: upsert in batches within a single transaction
  const pool = await getPool();
  // Preload dictionary codes so we can skip unknown style/season/tag values
  const knownSeasons = new Set<string>((await pool.request().query<{ code: string }>('SELECT code FROM seasons')).recordset.map(r => r.code));
  const knownStyles = new Set<string>((await pool.request().query<{ code: string }>('SELECT code FROM garment_styles')).recordset.map(r => r.code));
  const knownTags = new Set<string>((await pool.request().query<{ code: string }>('SELECT code FROM feature_tags')).recordset.map(r => r.code));
  const knownFinishes = new Set<string>((await pool.request().query<{ code: string }>('SELECT code FROM finishes')).recordset.map(r => r.code));

  const tx = new sql.Transaction(pool);
  await tx.begin();
  let successCount = 0;
  try {
    // Cache supplier ids within this batch
    const supplierCache = new Map<string, string>();
    for (const row of valid) {
      // Dedupe + filter out codes that don't exist in the dictionary (silently dropped)
      row.seasons = Array.from(new Set(row.seasons.filter(s => knownSeasons.has(s))));
      row.garmentStyles = Array.from(new Set(row.garmentStyles.filter(s => knownStyles.has(s))));
      row.featureTags = Array.from(new Set(row.featureTags.filter(s => knownTags.has(s))));
      try {
        let supplierId = supplierCache.get(row.supplierName);
        if (!supplierId) {
          supplierId = await ensureSupplierId(tx as any, row.supplierName);
          supplierCache.set(row.supplierName, supplierId);
        }
        const id = generateId(row.name, row.code);
        // upsert: if exists, update; else insert
        const existing = await tx
          .request()
          .input('id', sql.NVarChar(32), id)
          .query<{ id: string }>('SELECT id FROM fabrics WHERE id = @id');
        if (existing.recordset.length > 0) {
          await tx
            .request()
            .input('id', sql.NVarChar(32), id)
            .input('name', sql.NVarChar(128), row.name)
            .input('category', sql.NVarChar(32), row.category)
            .input('supplierId', sql.UniqueIdentifier, supplierId)
            .input('compositionRaw', sql.NVarChar(255), row.compositionRaw)
            .input('widthCm', sql.Int, row.widthCm)
            .input('weightGsm', sql.Int, row.weightGsm)
            .input('structure', sql.NVarChar(64), row.structure)
            .input('finishRaw', sql.NVarChar(64), row.finishRaw)
            .input('frStandard', sql.NVarChar(64), row.frStandard)
            .input('priceRmbPerM', sql.Decimal(10, 2), row.priceRmbPerM)
            .input('fobUsdPerM', sql.Decimal(10, 2), row.fobUsdPerM)
            .input('moq', sql.NVarChar(32), row.moq)
            .input('sellingPoints', sql.NVarChar(sql.MAX), row.sellingPoints)
            .input('notes', sql.NVarChar(sql.MAX), row.notes)
            .input('sourceFile', sql.NVarChar(255), row.sourceFile)
            .input('sourceRow', sql.Int, row.sourceRow)
            .input('code', sql.NVarChar(64), row.code)
            .query(
              `UPDATE fabrics SET
                 name = @name, category_code = @category, supplier_id = @supplierId,
                 composition_raw = @compositionRaw, width_cm = @widthCm, weight_gsm = @weightGsm,
                 structure = @structure, finish_raw = @finishRaw, fr_standard = @frStandard,
                 price_rmb_per_m = @priceRmbPerM, fob_usd_per_m = @fobUsdPerM, moq = @moq,
                 selling_points = @sellingPoints, notes = @notes,
                 source_file = @sourceFile, source_row = @sourceRow, code = @code,
                 updated_at = SYSUTCDATETIME()
               WHERE id = @id`,
            );
        } else {
          await tx
            .request()
            .input('id', sql.NVarChar(32), id)
            .input('code', sql.NVarChar(64), row.code)
            .input('name', sql.NVarChar(128), row.name)
            .input('category', sql.NVarChar(32), row.category)
            .input('supplierId', sql.UniqueIdentifier, supplierId)
            .input('compositionRaw', sql.NVarChar(255), row.compositionRaw)
            .input('widthCm', sql.Int, row.widthCm)
            .input('weightGsm', sql.Int, row.weightGsm)
            .input('structure', sql.NVarChar(64), row.structure)
            .input('finishRaw', sql.NVarChar(64), row.finishRaw)
            .input('frStandard', sql.NVarChar(64), row.frStandard)
            .input('priceRmbPerM', sql.Decimal(10, 2), row.priceRmbPerM)
            .input('fobUsdPerM', sql.Decimal(10, 2), row.fobUsdPerM)
            .input('moq', sql.NVarChar(32), row.moq)
            .input('sellingPoints', sql.NVarChar(sql.MAX), row.sellingPoints)
            .input('notes', sql.NVarChar(sql.MAX), row.notes)
            .input('sourceFile', sql.NVarChar(255), row.sourceFile)
            .input('sourceRow', sql.Int, row.sourceRow)
            .query(
              `INSERT INTO fabrics
                 (id, code, name, category_code, supplier_id, composition_raw,
                  width_cm, weight_gsm, structure, finish_raw, fr_standard,
                  price_rmb_per_m, fob_usd_per_m, moq,
                  selling_points, notes, source_file, source_row)
               VALUES
                 (@id, @code, @name, @category, @supplierId, @compositionRaw,
                  @widthCm, @weightGsm, @structure, @finishRaw, @frStandard,
                  @priceRmbPerM, @fobUsdPerM, @moq,
                  @sellingPoints, @notes, @sourceFile, @sourceRow)`,
            );
        }
        // Replace compositions + multi-value joins
        await tx.request().input('id', sql.NVarChar(32), id).query('DELETE FROM fabric_compositions WHERE fabric_id = @id');
        await tx.request().input('id', sql.NVarChar(32), id).query('DELETE FROM fabric_seasons WHERE fabric_id = @id');
        await tx.request().input('id', sql.NVarChar(32), id).query('DELETE FROM fabric_garment_styles WHERE fabric_id = @id');
        await tx.request().input('id', sql.NVarChar(32), id).query('DELETE FROM fabric_feature_tags WHERE fabric_id = @id');
        for (const c of row.fiberPercents) {
          await tx
            .request()
            .input('id', sql.NVarChar(32), id)
            .input('fiber', sql.NVarChar(32), c.fiber)
            .input('pct', sql.Decimal(5, 2), c.pct)
            .query(
              `INSERT INTO fabric_compositions (fabric_id, fiber_code, percentage)
               VALUES (@id, @fiber, @pct)`,
            );
        }
        if (row.seasons.length > 0) {
          const values = row.seasons.map((_, i) => `(@id, @s${i})`).join(',');
          const req = tx.request().input('id', sql.NVarChar(32), id);
          row.seasons.forEach((s, i) => req.input(`s${i}`, sql.NVarChar(16), s));
          await req.query(`INSERT INTO fabric_seasons (fabric_id, season_code) VALUES ${values}`);
        }
        if (row.garmentStyles.length > 0) {
          const values = row.garmentStyles.map((_, i) => `(@id, @s${i})`).join(',');
          const req = tx.request().input('id', sql.NVarChar(32), id);
          row.garmentStyles.forEach((s, i) => req.input(`s${i}`, sql.NVarChar(32), s));
          await req.query(`INSERT INTO fabric_garment_styles (fabric_id, garment_style_code) VALUES ${values}`);
        }
        if (row.featureTags.length > 0) {
          const values = row.featureTags.map((_, i) => `(@id, @s${i})`).join(',');
          const req = tx.request().input('id', sql.NVarChar(32), id);
          row.featureTags.forEach((s, i) => req.input(`s${i}`, sql.NVarChar(32), s));
          await req.query(`INSERT INTO fabric_feature_tags (fabric_id, feature_tag_code) VALUES ${values}`);
        }
        successCount++;
      } catch (err: any) {
        errors.push({
          row: row.sourceRow ?? 0,
          message: `保存失败: ${err.message ?? String(err)}`,
        });
      }
    }
    await tx.commit();
  } catch (err: any) {
    await tx.rollback();
    throw err;
  }

  return await saveBatchAndReturn(file, [], errors, userId, start, successCount, parsed.length);
}

async function saveBatchAndReturn(
  file: { originalname: string; size: number },
  _valid: unknown[],
  errors: ImportErrorRow[],
  userId: string | null,
  start: number,
  successCount = 0,
  totalRows = 0,
): Promise<ImportResultDto> {
  const pool = await getPool();
  const fileHash = crypto.createHash('sha256').update(file.originalname + String(file.size)).digest('hex');
  const failedCount = errors.filter((e) => e.row > 0).length;
  const result = await pool
    .request()
    .input('filename', sql.NVarChar(255), file.originalname)
    .input('fileHash', sql.Char(64), fileHash)
    .input('totalRows', sql.Int, totalRows)
    .input('successCount', sql.Int, successCount)
    .input('failedCount', sql.Int, failedCount)
    .input('errorReport', sql.NVarChar(sql.MAX), errors.length > 0 ? JSON.stringify(errors) : null)
    .input('userId', sql.UniqueIdentifier, userId)
    .query<{ id: string }>(
      `INSERT INTO import_batches (filename, file_hash, total_rows, success_count, failed_count, error_report, user_id, finished_at)
       OUTPUT INSERTED.id AS id
       VALUES (@filename, @fileHash, @totalRows, @successCount, @failedCount, @errorReport, @userId, SYSUTCDATETIME())`,
    );
  return {
    batchId: result.recordset[0].id,
    filename: file.originalname,
    totalRows,
    successCount,
    failedCount,
    errors,
    durationMs: Date.now() - start,
  };
}

export async function getImportBatch(batchId: string): Promise<{
  id: string;
  filename: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  errorReport: ImportErrorRow[] | null;
  userId: string | null;
  createdAt: string;
  finishedAt: string | null;
} | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, batchId)
    .query<{
      id: string; filename: string; total_rows: number; success_count: number;
      failed_count: number; error_report: string | null; user_id: string | null;
      created_at: Date; finished_at: Date | null;
    }>(
      `SELECT id, filename, total_rows, success_count, failed_count, error_report, user_id, created_at, finished_at
         FROM import_batches WHERE id = @id`,
    );
  const row = result.recordset[0];
  if (!row) return null;
  return {
    id: row.id,
    filename: row.filename,
    totalRows: row.total_rows,
    successCount: row.success_count,
    failedCount: row.failed_count,
    errorReport: row.error_report ? JSON.parse(row.error_report) : null,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
  };
}

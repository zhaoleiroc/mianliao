// src/services/dict.service.ts
// Dictionary lookups (categories / seasons / styles / tags / finishes / suppliers).

import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { categoryLabel } from '../utils/labels.js';
import type { Category, DictionaryBundle, DictItemDto, SupplierDictDto } from '../types/api.js';
import { NotFoundError, BadRequestError } from '../middleware/error.js';

const KNOWN_DICTS = ['categories', 'seasons', 'garment_styles', 'feature_tags', 'finishes'] as const;
type DictType = (typeof KNOWN_DICTS)[number];

const DICT_TO_TABLE: Record<DictType, string> = {
  categories: 'categories',
  seasons: 'seasons',
  garment_styles: 'garment_styles',
  feature_tags: 'feature_tags',
  finishes: 'finishes',
};

const DICT_TO_CODE_COL: Record<DictType, string> = {
  categories: 'code',
  seasons: 'code',
  garment_styles: 'code',
  feature_tags: 'code',
  finishes: 'code',
};

export function isDictType(s: string): s is DictType {
  return (KNOWN_DICTS as readonly string[]).includes(s);
}

async function listDict(type: DictType): Promise<DictItemDto[]> {
  const pool = await getPool();
  const orderCol = type === 'categories' ? 'sort_order, code' : 'sort_order, id';
  const result = await pool.request().query<{ code: string; name_zh: string; sort_order: number }>(
    `SELECT ${DICT_TO_CODE_COL[type]} AS code, name_zh, sort_order
       FROM ${DICT_TO_TABLE[type]}
       ORDER BY ${orderCol}`,
  );
  return result.recordset.map((r) => ({ code: r.code, label: r.name_zh, sortOrder: r.sort_order }));
}

async function listSuppliers(): Promise<SupplierDictDto[]> {
  const pool = await getPool();
  const result = await pool.request().query<{ id: string; name: string; short_name: string | null }>(
    `SELECT id, name, short_name FROM suppliers WHERE is_active = 1 ORDER BY name`,
  );
  return result.recordset.map((r) => ({ id: r.id, name: r.name, shortName: r.short_name }));
}

export async function getAllDictionaries(): Promise<DictionaryBundle> {
  const [categories, seasons, garmentStyles, featureTags, finishes, suppliers] = await Promise.all([
    listDict('categories') as Promise<DictItemDto<Category, string>[]>,
    listDict('seasons'),
    listDict('garment_styles'),
    listDict('feature_tags'),
    listDict('finishes'),
    listSuppliers(),
  ]);
  return { categories, seasons, garmentStyles, featureTags, finishes, suppliers };
}

export async function getDictionary(type: string): Promise<DictItemDto[] | SupplierDictDto[]> {
  if (type === 'suppliers') return listSuppliers();
  if (!isDictType(type)) throw new BadRequestError(`未知字典类型: ${type}`);
  return listDict(type);
}

export async function dictItemCreate(
  type: DictType,
  input: { code: string; nameZh: string; sortOrder?: number },
): Promise<void> {
  const pool = await getPool();
  try {
    await pool
      .request()
      .input('code', sql.NVarChar(64), input.code)
      .input('nameZh', sql.NVarChar(64), input.nameZh)
      .input('sortOrder', sql.Int, input.sortOrder ?? 0)
      .query(
        `INSERT INTO ${DICT_TO_TABLE[type]} (${DICT_TO_CODE_COL[type]}, name_zh, sort_order)
         VALUES (@code, @nameZh, @sortOrder)`,
      );
  } catch (err: any) {
    if (err.number === 2627) throw new BadRequestError('code 已存在');
    throw err;
  }
}

export async function dictItemUpdate(
  type: DictType,
  code: string,
  input: { nameZh?: string; sortOrder?: number },
): Promise<void> {
  const sets: string[] = [];
  const req = (await getPool()).request().input('code', sql.NVarChar(64), code);
  if (input.nameZh !== undefined) {
    sets.push('name_zh = @nameZh');
    req.input('nameZh', sql.NVarChar(64), input.nameZh);
  }
  if (input.sortOrder !== undefined) {
    sets.push('sort_order = @sortOrder');
    req.input('sortOrder', sql.Int, input.sortOrder);
  }
  if (sets.length === 0) return;
  const result = await req.query(
    `UPDATE ${DICT_TO_TABLE[type]} SET ${sets.join(', ')} WHERE ${DICT_TO_CODE_COL[type]} = @code`,
  );
  if (result.rowsAffected[0] === 0) throw new NotFoundError('项不存在');
}

export async function dictItemDelete(type: DictType, code: string): Promise<void> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('code', sql.NVarChar(64), code)
    .query(`DELETE FROM ${DICT_TO_TABLE[type]} WHERE ${DICT_TO_CODE_COL[type]} = @code`);
  if (result.rowsAffected[0] === 0) throw new NotFoundError('项不存在');
}

// ---------- suppliers ----------

export async function listSuppliersFull(): Promise<{
  id: string;
  name: string;
  shortName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  fabricCount: number;
}[]> {
  const pool = await getPool();
  const result = await pool.request().query<{
    id: string; name: string; short_name: string | null; phone: string | null;
    email: string | null; address: string | null; notes: string | null;
    is_active: boolean; fabric_count: number;
  }>(
    `SELECT s.id, s.name, s.short_name, s.phone, s.email, s.address, s.notes, s.is_active,
            (SELECT COUNT(*) FROM fabrics f WHERE f.supplier_id = s.id AND f.is_deleted = 0) AS fabric_count
       FROM suppliers s
       ORDER BY s.name`,
  );
  return result.recordset.map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.short_name,
    phone: r.phone,
    email: r.email,
    address: r.address,
    notes: r.notes,
    isActive: r.is_active,
    fabricCount: r.fabric_count,
  }));
}

export async function createSupplier(input: {
  name: string;
  shortName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<string> {
  const pool = await getPool();
  try {
    const result = await pool
      .request()
      .input('name', sql.NVarChar(128), input.name)
      .input('shortName', sql.NVarChar(32), input.shortName ?? null)
      .input('phone', sql.NVarChar(32), input.phone ?? null)
      .input('email', sql.NVarChar(128), input.email ?? null)
      .input('address', sql.NVarChar(255), input.address ?? null)
      .input('notes', sql.NVarChar(sql.MAX), input.notes ?? null)
      .query<{ id: string }>(
        `INSERT INTO suppliers (name, short_name, phone, email, address, notes)
         OUTPUT INSERTED.id AS id
         VALUES (@name, @shortName, @phone, @email, @address, @notes)`,
      );
    return result.recordset[0].id;
  } catch (err: any) {
    if (err.number === 2627) throw new BadRequestError('供应商名称已存在');
    throw err;
  }
}

export async function updateSupplier(
  id: string,
  input: {
    name?: string;
    shortName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
): Promise<void> {
  const sets: string[] = [];
  const req = (await getPool()).request().input('id', sql.UniqueIdentifier, id);
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    const col = {
      name: 'name',
      shortName: 'short_name',
      phone: 'phone',
      email: 'email',
      address: 'address',
      notes: 'notes',
      isActive: 'is_active',
    }[k];
    if (!col) continue;
    sets.push(`${col} = @${k}`);
    if (k === 'isActive') {
      req.input(k, sql.Bit, v as boolean);
    } else {
      req.input(k, sql.NVarChar(255), v as string);
    }
  }
  if (sets.length === 0) return;
  sets.push('updated_at = SYSUTCDATETIME()');
  const result = await req.query(
    `UPDATE suppliers SET ${sets.join(', ')} WHERE id = @id`,
  );
  if (result.rowsAffected[0] === 0) throw new NotFoundError('供应商不存在');
}

export async function deleteSupplier(id: string): Promise<void> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query('DELETE FROM suppliers WHERE id = @id');
  if (result.rowsAffected[0] === 0) throw new NotFoundError('供应商不存在');
}

// category label helper re-export
export { categoryLabel };

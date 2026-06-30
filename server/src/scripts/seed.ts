// src/scripts/seed.ts
// Seed the database with the 86 fabrics, suppliers, dictionaries,
// style notes, images, supplier quotes, and an admin user from
// the existing JSON files in ../../data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { getPool, closePool } from '../db/pool.js';
import { config } from '../config/index.js';
import { hashPassword } from '../utils/password.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'assets', 'fabrics');
const UPLOAD_ARCHIVE = path.resolve(config.upload.dir, 'archive');

// ---------- JSON shapes ----------

interface FabricJson {
  id: string;
  supplier?: string;
  supplier_brand?: string;
  category: string;
  name: string;
  code: string | null;
  composition_raw?: string | null;
  composition?: Record<string, number>;
  weave?: string | null;
  structure?: string | null;
  finish?: string | null;
  spec_raw?: string | null;
  width_cm?: number | null;
  weight_gsm?: number | null;
  weight_range?: { min: number; max: number } | null;
  features?: string[];
  applications?: string[];
  tags?: string[];
  texture?: string | null;
  color?: string | null;
  flame_retardant?: boolean;
  fr_standard?: string | null;
  edge?: string | null;
  moq?: number | string | null;
  fob_usd_per_m?: number | string | null;
  price_rmb_per_m?: number | string | null;
  supplier_quotes?: SupplierQuoteJson[];
  source_file?: string;
  source_row?: number | null;
  source_row_first?: number | null;
}

interface SupplierQuoteJson {
  supplier: string;
  price_rmb_per_m: number | string | null;
  moq: string | number | null;
  phone: string | null;
  email: string | null;
}

interface SupplierJson {
  name: string;
  phone: string | null;
  email: string | null;
  quote_count: number;
  fabric_count: number;
  fabric_ids: string[];
}

interface StyleNoteJson {
  id: string;
  supplier_brand: string;
  category: string;
  style_description: string;
  fabric_description: string | null;
  fabric_composition: Record<string, number>;
  extra_notes: string | null;
  source_file?: string;
  source_row?: number | null;
}

interface ImageItemJson {
  original_path: string;
  original_filename: string;
  archive_path: string;
  category_hint: string;
  supplier_hint: string;
  match_reason: string;
  match_confidence: string;
  size_bytes: number;
  sha1_8: string;
  needs_review: boolean;
  matched_fabric_id: string | null;
  matched_fabric_name: string | null;
  copy_status: string;
}

interface ImageManifestJson {
  generated_at: string;
  archive_root: string;
  apply_mode: boolean;
  counts: { total: number; by_category: Record<string, number>; needs_review: number };
  items: ImageItemJson[];
}

// ---------- helpers ----------

const KNOWN_CATEGORIES = ['knit', 'woven', 'pu_suede', 'home_textile'] as const;

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function copyDirSync(src: string, dest: string): number {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      count += copyDirSync(s, d);
    } else if (e.isFile()) {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

async function execOrSkip<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.number === 2627 || err?.number === 2601) {
      console.log(`  ↺ ${label} (already exists, skipped)`);
      return null;
    }
    throw err;
  }
}

// ---------- main ----------

async function main(): Promise<void> {
  const pool = await getPool();
  console.log('▶ Connected to mianliao');

  // ---- 1. roles ----
  console.log('▶ Seeding roles…');
  for (const r of [
    { code: 'admin', name_zh: '管理员', description: '全部权限' },
    { code: 'purchaser', name_zh: '采购', description: '面料与字典 CRUD，不可管理用户' },
    { code: 'viewer', name_zh: '访客', description: '只读后台' },
  ]) {
    await execOrSkip(`role ${r.code}`, () =>
      pool
        .request()
        .input('code', sql.NVarChar(32), r.code)
        .input('name_zh', sql.NVarChar(64), r.name_zh)
        .input('description', sql.NVarChar(255), r.description)
        .query(
          'INSERT INTO roles (code, name_zh, description) VALUES (@code, @name_zh, @description)',
        ),
    );
  }

  // ---- 2. admin user ----
  console.log(`▶ Seeding admin user (${config.seed.adminUsername})…`);
  const passwordHash = await hashPassword(config.seed.adminPassword);
  const adminResult = await execOrSkip('admin user', () =>
    pool
      .request()
      .input('username', sql.NVarChar(64), config.seed.adminUsername)
      .input('password_hash', sql.NVarChar(255), passwordHash)
      .input('display_name', sql.NVarChar(64), config.seed.adminDisplayName)
      .query<{ id: string }>(
        `INSERT INTO users (username, password_hash, display_name, is_active)
         OUTPUT INSERTED.id AS id
         VALUES (@username, @password_hash, @display_name, 1)`,
      ),
  );
  let adminId: string;
  if (adminResult) {
    adminId = adminResult.recordset[0].id;
    await pool
      .request()
      .input('userId', sql.UniqueIdentifier, adminId)
      .input('code', sql.NVarChar(32), 'admin')
      .query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES (@userId, (SELECT id FROM roles WHERE code = @code))`,
      );
    console.log(`  ✓ Created admin user (id=${adminId})`);
  } else {
    const found = await pool
      .request()
      .input('username', sql.NVarChar(64), config.seed.adminUsername)
      .query<{ id: string }>('SELECT id FROM users WHERE username = @username');
    adminId = found.recordset[0].id;
    console.log(`  ↺ Admin user exists (id=${adminId})`);
  }

  // ---- 3. categories ----
  console.log('▶ Seeding categories…');
  const categoriesData = [
    { code: 'knit', name_zh: '针织', description: '摇粒绒 / 卫衣 / Polo / 网眼' },
    { code: 'woven', name_zh: '化纤梭织', description: '裤料 / 外套 / 防晒 / 冲锋衣' },
    { code: 'pu_suede', name_zh: 'PU 麂皮', description: '鞋面 / 箱包 / 装饰面料' },
    { code: 'home_textile', name_zh: '家纺阻燃', description: 'EN13773 阻燃窗帘与沙发布' },
  ];
  for (let i = 0; i < categoriesData.length; i++) {
    const c = categoriesData[i];
    await execOrSkip(`category ${c.code}`, () =>
      pool
        .request()
        .input('code', sql.NVarChar(32), c.code)
        .input('name_zh', sql.NVarChar(64), c.name_zh)
        .input('description', sql.NVarChar(255), c.description)
        .input('sort_order', sql.Int, i)
        .query(
          'INSERT INTO categories (code, name_zh, description, sort_order) VALUES (@code, @name_zh, @description, @sort_order)',
        ),
    );
  }

  // ---- 4. dictionaries (seasons / styles / tags / finishes / weaves) ----
  console.log('▶ Seeding dictionaries…');
  const seasons = [
    { code: 'spring', name_zh: '春' }, { code: 'summer', name_zh: '夏' },
    { code: 'fall', name_zh: '秋' }, { code: 'winter', name_zh: '冬' },
    { code: 'all', name_zh: '四季' },
  ];
  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    await execOrSkip(`season ${s.code}`, () =>
      pool.request()
        .input('code', sql.NVarChar(16), s.code)
        .input('name_zh', sql.NVarChar(16), s.name_zh)
        .input('sort_order', sql.Int, i)
        .query('INSERT INTO seasons (code, name_zh, sort_order) VALUES (@code, @name_zh, @sort_order)'),
    );
  }
  const garmentStyles = [
    '外套', 'T恤', '卫衣', '衬衫', '夹克', '家居服',
    '运动服', '童装', '内裤', '床品', '窗帘', '马甲', '工装裤', 'Polo衫',
  ];
  for (let i = 0; i < garmentStyles.length; i++) {
    const code = garmentStyles[i];
    await execOrSkip(`style ${code}`, () =>
      pool.request()
        .input('code', sql.NVarChar(32), code)
        .input('name_zh', sql.NVarChar(32), code)
        .input('sort_order', sql.Int, i)
        .query('INSERT INTO garment_styles (code, name_zh, sort_order) VALUES (@code, @name_zh, @sort_order)'),
    );
  }
  const featureTags = [
    '保暖', '透气', '弹力', '亲肤', '挺括', '垂感',
    '抗皱', '抗起球', '防水', '阻燃', '再生环保', '复古',
  ];
  for (let i = 0; i < featureTags.length; i++) {
    const code = featureTags[i];
    await execOrSkip(`tag ${code}`, () =>
      pool.request()
        .input('code', sql.NVarChar(32), code)
        .input('name_zh', sql.NVarChar(32), code)
        .input('sort_order', sql.Int, i)
        .query('INSERT INTO feature_tags (code, name_zh, sort_order) VALUES (@code, @name_zh, @sort_order)'),
    );
  }
  const finishes = [
    '磨毛', '压花', '烫金', '烫银', '印花',
    'PU涂层', '防水涂层', '抗静电', '抗菌', '阻燃处理',
  ];
  for (let i = 0; i < finishes.length; i++) {
    const code = finishes[i];
    await execOrSkip(`finish ${code}`, () =>
      pool.request()
        .input('code', sql.NVarChar(32), code)
        .input('name_zh', sql.NVarChar(32), code)
        .input('sort_order', sql.Int, i)
        .query('INSERT INTO finishes (code, name_zh, sort_order) VALUES (@code, @name_zh, @sort_order)'),
    );
  }
  const weaves = [
    { code: '纬编针织', name_zh: '纬编针织' }, { code: '经编针织', name_zh: '经编针织' },
    { code: 'PLAIN', name_zh: '平纹' }, { code: 'TWILL', name_zh: '斜纹' },
    { code: 'SATIN', name_zh: '缎纹' }, { code: 'JACQUARD', name_zh: '提花' },
    { code: 'CORDUROY', name_zh: '灯芯绒' }, { code: 'FLEECE_COMPOSITE', name_zh: '摇粒绒复合' },
  ];
  for (let i = 0; i < weaves.length; i++) {
    const w = weaves[i];
    await execOrSkip(`weave ${w.code}`, () =>
      pool.request()
        .input('code', sql.NVarChar(64), w.code)
        .input('name_zh', sql.NVarChar(64), w.name_zh)
        .input('sort_order', sql.Int, i)
        .query('INSERT INTO weaves (code, name_zh, sort_order) VALUES (@code, @name_zh, @sort_order)'),
    );
  }

  // ---- 5. suppliers ----
  console.log('▶ Seeding suppliers…');
  const suppliersJson = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'suppliers.json'), 'utf8'),
  ) as { suppliers: SupplierJson[] };
  const supplierIdByName = new Map<string, string>();
  for (const s of suppliersJson.suppliers) {
    const isActive = s.name !== 'home_fr' || true;
    const shortName = s.name === '3S-AVVA' ? '3S-AVVA'
      : s.name === '常熟市华瑞针纺织' ? 'huarui'
      : s.name === '中涛·三时' ? 'zhongtao'
      : s.name === '万泰' ? 'wantai'
      : s.name === 'home_fr' ? 'home_fr'
      : null;
    const result = await execOrSkip(`supplier ${s.name}`, () =>
      pool
        .request()
        .input('name', sql.NVarChar(128), s.name)
        .input('short_name', sql.NVarChar(32), shortName)
        .input('phone', sql.NVarChar(32), s.phone)
        .input('email', sql.NVarChar(128), s.email)
        .input('is_active', sql.Bit, isActive)
        .query<{ id: string }>(
          `INSERT INTO suppliers (name, short_name, phone, email, is_active)
           OUTPUT INSERTED.id AS id VALUES (@name, @short_name, @phone, @email, @is_active)`,
        ),
    );
    let id: string;
    if (result) {
      id = result.recordset[0].id;
    } else {
      const found = await pool
        .request()
        .input('name', sql.NVarChar(128), s.name)
        .query<{ id: string }>('SELECT id FROM suppliers WHERE name = @name');
      id = found.recordset[0].id;
    }
    supplierIdByName.set(s.name, id);
  }

  // ---- 6. fabrics ----
  console.log('▶ Seeding fabrics…');
  const fabricsJson = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'fabrics.json'), 'utf8'),
  ) as { fabrics: FabricJson[] };

  // Map "supplier_brand" or "supplier" name to a supplier_id
  function resolveSupplierId(f: FabricJson): string {
    if (f.supplier_brand && supplierIdByName.has(f.supplier_brand)) {
      return supplierIdByName.get(f.supplier_brand)!;
    }
    if (f.supplier && supplierIdByName.has(f.supplier)) {
      return supplierIdByName.get(f.supplier)!;
    }
    // 3S-AVVA fabrics use supplier_brand but no supplier; map to a generic one
    if (f.supplier_brand) {
      for (const [name, id] of supplierIdByName.entries()) {
        if (name.includes('3S') || name.includes('AVVA')) return id;
      }
    }
    throw new Error(`Cannot resolve supplier for fabric ${f.id} (${f.name})`);
  }

  for (let fi = 0; fi < fabricsJson.fabrics.length; fi++) {
    const f = fabricsJson.fabrics[fi];
    let supplierId: string;
    try {
      supplierId = resolveSupplierId(f);
    } catch (err: any) {
      console.error(`  ✗ fabric[${fi}] ${f.id} (${f.name}) supplier resolve: ${err.message}`);
      throw err;
    }
    const cat = KNOWN_CATEGORIES.includes(f.category as any) ? f.category : 'knit';
    if (fi < 5 || fi === 64) {
      console.log(`  ▶ fabric[${fi}] ${f.id} (${f.name}) supplier_id=${supplierId}`);
    }
    await pool
      .request()
      .input('id', sql.NVarChar(32), f.id)
      .input('code', sql.NVarChar(64), f.code ?? null)
      .input('name', sql.NVarChar(128), f.name)
      .input('category_code', sql.NVarChar(32), cat)
      .input('supplier_id', sql.UniqueIdentifier, supplierId)
      .input('supplier_brand', sql.NVarChar(64), f.supplier_brand ?? null)
      .input('composition_raw', sql.NVarChar(255), f.composition_raw ?? null)
      .input('spec_raw', sql.NVarChar(64), f.spec_raw ?? null)
      .input('structure', sql.NVarChar(64), f.structure ?? null)
      .input('finish_raw', sql.NVarChar(64), f.finish ?? null)
      .input('width_cm', sql.Int, f.width_cm ?? null)
      .input('weight_gsm', sql.Int, f.weight_gsm ?? null)
      .input('weight_range_min', sql.Int, f.weight_range?.min ?? null)
      .input('weight_range_max', sql.Int, f.weight_range?.max ?? null)
      .input('texture', sql.NVarChar(64), f.texture ?? null)
      .input('color', sql.NVarChar(64), f.color ?? null)
      .input('flame_retardant', sql.Bit, f.flame_retardant ?? false)
      .input('fr_standard', sql.NVarChar(64), f.fr_standard ?? null)
      .input('edge', sql.NVarChar(64), f.edge ?? null)
      .input('moq', sql.NVarChar(32), f.moq == null ? null : String(f.moq))
      .input('fob_usd_per_m', sql.Decimal(10, 2), num(f.fob_usd_per_m))
      .input('price_rmb_per_m', sql.Decimal(10, 2), num(f.price_rmb_per_m))
      .input('source_file', sql.NVarChar(255), f.source_file ?? null)
      .input('source_row', sql.Int, f.source_row ?? null)
      .query(
        `INSERT INTO fabrics
          (id, code, name, category_code, supplier_id, supplier_brand,
           composition_raw, spec_raw, structure, finish_raw,
           width_cm, weight_gsm, weight_range_min, weight_range_max,
           texture, color, flame_retardant, fr_standard, edge,
           moq, fob_usd_per_m, price_rmb_per_m,
           source_file, source_row)
         VALUES
          (@id, @code, @name, @category_code, @supplier_id, @supplier_brand,
           @composition_raw, @spec_raw, @structure, @finish_raw,
           @width_cm, @weight_gsm, @weight_range_min, @weight_range_max,
           @texture, @color, @flame_retardant, @fr_standard, @edge,
           @moq, @fob_usd_per_m, @price_rmb_per_m,
           @source_file, @source_row)`,
      );

    // compositions
    if (f.composition) {
      for (const [fiber, pct] of Object.entries(f.composition)) {
        await pool
          .request()
          .input('fabric_id', sql.NVarChar(32), f.id)
          .input('fiber_code', sql.NVarChar(32), fiber)
          .input('pct', sql.Decimal(5, 2), pct)
          .query(
            'INSERT INTO fabric_compositions (fabric_id, fiber_code, percentage) VALUES (@fabric_id, @fiber_code, @pct)',
          );
      }
    }
    // applications → garment_styles (only known codes)
    if (f.applications && f.applications.length > 0) {
      for (const a of f.applications) {
        // Normalize: "Polo 衫" → "Polo衫", "夹克/夹棉" → "夹克"
        let normalized = a.replace(/\s+/g, '').replace(/\/.*$/, '');
        // Skip if not in dictionary
        if (!garmentStyles.includes(normalized)) continue;
        await execOrSkip(`gs ${f.id} / ${normalized}`, () =>
          pool
            .request()
            .input('fabric_id', sql.NVarChar(32), f.id)
            .input('code', sql.NVarChar(32), normalized)
            .query(
              `INSERT INTO fabric_garment_styles (fabric_id, garment_style_code)
               VALUES (@fabric_id, @code)`,
            ),
        );
      }
    }
    // features → feature_tags (best-effort, only known tags)
    if (f.features) {
      for (const feat of f.features) {
        for (const tag of featureTags) {
          if (feat.includes(tag)) {
            await execOrSkip(`tag ${f.id} / ${tag}`, () =>
              pool
                .request()
                .input('fabric_id', sql.NVarChar(32), f.id)
                .input('code', sql.NVarChar(32), tag)
                .query(
                  `INSERT INTO fabric_feature_tags (fabric_id, feature_tag_code)
                   VALUES (@fabric_id, @code)`,
                ),
            );
          }
        }
      }
    }
    // supplier_quotes
    if (f.supplier_quotes) {
      for (let i = 0; i < f.supplier_quotes.length; i++) {
        const q = f.supplier_quotes[i];
        await pool
          .request()
          .input('fabric_id', sql.NVarChar(32), f.id)
          .input('supplier_name', sql.NVarChar(128), q.supplier)
          .input('price_rmb_per_m', sql.Decimal(10, 2), num(q.price_rmb_per_m))
          .input('moq', sql.NVarChar(32), q.moq == null ? null : String(q.moq))
          .input('phone', sql.NVarChar(32), q.phone ?? null)
          .input('email', sql.NVarChar(128), q.email ?? null)
          .input('sort_order', sql.Int, i)
          .query(
            `INSERT INTO supplier_quotes
               (fabric_id, supplier_name, price_rmb_per_m, moq, phone, email, sort_order)
             VALUES
               (@fabric_id, @supplier_name, @price_rmb_per_m, @moq, @phone, @email, @sort_order)`,
          );
      }
    }
  }
  console.log(`  ✓ Inserted/checked ${fabricsJson.fabrics.length} fabrics`);

  // ---- 7. style_notes ----
  console.log('▶ Seeding style notes…');
  const stylesJson = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'styles.json'), 'utf8'),
  ) as { styles: StyleNoteJson[] };
  for (const sn of stylesJson.styles) {
    const result = await pool
      .request()
      .input('supplier_brand', sql.NVarChar(64), sn.supplier_brand)
      .input('style_description', sql.NVarChar(sql.MAX), sn.style_description)
      .input('fabric_description', sql.NVarChar(255), sn.fabric_description)
      .input('extra_notes', sql.NVarChar(sql.MAX), sn.extra_notes)
      .input('source_file', sql.NVarChar(255), sn.source_file ?? null)
      .input('source_row', sql.Int, sn.source_row ?? null)
      .query<{ id: string }>(
        `INSERT INTO style_notes
           (supplier_brand, style_description, fabric_description, extra_notes, source_file, source_row)
         OUTPUT INSERTED.id AS id
         VALUES (@supplier_brand, @style_description, @fabric_description, @extra_notes, @source_file, @source_row)`,
      );
    const styleId = result.recordset[0].id;
    for (const [fiber, pct] of Object.entries(sn.fabric_composition ?? {})) {
      await pool
        .request()
        .input('style_note_id', sql.UniqueIdentifier, styleId)
        .input('fiber_code', sql.NVarChar(32), fiber)
        .input('pct', sql.Decimal(5, 2), pct)
        .query(
          'INSERT INTO style_note_compositions (style_note_id, fiber_code, percentage) VALUES (@style_note_id, @fiber_code, @pct)',
        );
    }
  }
  console.log(`  ✓ Inserted ${stylesJson.styles.length} style notes`);

  // ---- 8. fabric_images ----
  console.log('▶ Seeding fabric images…');
  const imageManifest = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'image_manifest.json'), 'utf8'),
  ) as ImageManifestJson;
  let imgCount = 0;
  for (const it of imageManifest.items) {
    if (!it.matched_fabric_id) continue;
    // archive_path is e.g. "assets/fabrics/knit/huarui/xxx.png".
    // Normalize slashes, strip the "assets/" prefix, AND the leading
    // "fabrics/" — the files are copied to wwwroot/uploads/archive/<cat>/<sup>/
    // (no "fabrics" segment). URLs must match the on-disk layout or
    // /uploads/* static serves will 404.
    const urlPath = it.archive_path
      .replace(/\\/g, '/')
      .replace(/^assets\/fabrics\//, '')
      .replace(/^fabrics\//, '');
    // Only the first image (per matched fabric, in manifest order) is the cover.
    // Subsequent images for the same fabric are non-cover with sort_order > 0.
    const seenSoFar = imageManifest.items
      .slice(0, imgCount)
      .filter((p) => p.matched_fabric_id === it.matched_fabric_id).length;
    const isCover = seenSoFar === 0;
    const sortOrder = seenSoFar;
    await execOrSkip(`image ${it.matched_fabric_id}`, () =>
      pool
        .request()
        .input('fabric_id', sql.NVarChar(32), it.matched_fabric_id!)
        .input('url', sql.NVarChar(512), `archive/${urlPath}`)
        .input('sort_order', sql.Int, sortOrder)
        .input('is_cover', sql.Bit, isCover)
        .input('source', sql.NVarChar(16), 'archive')
        .input('sha1_8', sql.Char(8), it.sha1_8)
        .query(
          `INSERT INTO fabric_images (fabric_id, url, sort_order, is_cover, source, sha1_8)
           VALUES (@fabric_id, @url, @sort_order, @is_cover, @source, @sha1_8)`,
        ),
    );
    imgCount++;
  }
  // Safety: per-fabric, keep only the lowest sort_order as cover.
  await pool.request().query(`
    UPDATE fi SET is_cover = 0 FROM fabric_images fi
    WHERE fi.is_cover = 1
      AND EXISTS (
        SELECT 1 FROM fabric_images fi2
        WHERE fi2.fabric_id = fi.fabric_id
          AND (fi2.sort_order < fi.sort_order
               OR (fi2.sort_order = fi.sort_order AND fi2.id < fi.id))
      )
  `);
  console.log(`  ✓ Inserted ${imgCount} fabric images`);

  // ---- 9. copy assets/fabrics → wwwroot/uploads/archive ----
  console.log(`▶ Copying ${ASSETS_DIR} → ${UPLOAD_ARCHIVE}…`);
  try {
    const count = copyDirSync(ASSETS_DIR, UPLOAD_ARCHIVE);
    console.log(`  ✓ Copied ${count} files`);
  } catch (err: any) {
    console.warn(`  ⚠ Asset copy failed: ${err.message}`);
  }

  // ---- 10. print summary ----
  const counts = await pool.request().query<{
    categories: number; suppliers: number; fabrics: number; quotes: number;
    images: number; styles: number; roles: number; users: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM categories) AS categories,
       (SELECT COUNT(*) FROM suppliers) AS suppliers,
       (SELECT COUNT(*) FROM fabrics WHERE is_deleted = 0) AS fabrics,
       (SELECT COUNT(*) FROM supplier_quotes) AS quotes,
       (SELECT COUNT(*) FROM fabric_images) AS images,
       (SELECT COUNT(*) FROM style_notes WHERE is_deleted = 0) AS styles,
       (SELECT COUNT(*) FROM roles) AS roles,
       (SELECT COUNT(*) FROM users) AS users`,
  );
  const c = counts.recordset[0];
  console.log('\n✅ Seed complete!');
  console.log(`   categories   : ${c.categories}`);
  console.log(`   suppliers    : ${c.suppliers}`);
  console.log(`   fabrics      : ${c.fabrics}`);
  console.log(`   supplier_quotes: ${c.quotes}`);
  console.log(`   images       : ${c.images}`);
  console.log(`   style_notes  : ${c.styles}`);
  console.log(`   roles        : ${c.roles}`);
  console.log(`   users        : ${c.users}`);
  console.log(`\n   Login: ${config.seed.adminUsername} / ${config.seed.adminPassword}`);
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    closePool().finally(() => process.exit(1));
  });

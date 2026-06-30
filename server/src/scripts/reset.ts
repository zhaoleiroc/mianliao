// src/scripts/reset.ts
// Drop all data tables (keep schema_migrations). Re-run migrate + seed.

import sql from 'mssql';
import { getPool, closePool } from '../db/pool.js';

async function main(): Promise<void> {
  const pool = await getPool();
  console.log('▶ Dropping all data tables (keeping schema)…');
  const tables = [
    'fabric_similarities', 'fabric_feature_tags', 'fabric_finishes',
    'fabric_garment_styles', 'fabric_seasons', 'fabric_compositions',
    'fabric_images', 'supplier_quotes', 'style_note_compositions',
    'style_notes', 'fabrics',
    'refresh_tokens', 'user_roles', 'users', 'roles',
    'feature_tags', 'finishes', 'garment_styles', 'seasons', 'weaves',
    'suppliers', 'categories',
    'audit_logs', 'import_batches',
  ];
  for (const t of tables) {
    try {
      await pool.request().query(`DELETE FROM ${t}`);
      console.log(`  ✓ cleared ${t}`);
    } catch (err: any) {
      console.warn(`  ⚠ ${t}: ${err.message}`);
    }
  }
  console.log('✅ Reset complete');
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Reset failed:', err);
    closePool().finally(() => process.exit(1));
  });

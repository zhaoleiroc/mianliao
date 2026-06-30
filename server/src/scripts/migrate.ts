// src/scripts/migrate.ts
// Migration runner: reads all *.sql files from src/migrations/ in lexical order,
// executes each in a single batch, and records filename in schema_migrations.
// Idempotent: skips files already applied.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { poolConfig, getPool, closePool } from '../db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

function splitBatches(content: string): string[] {
  // Each GO keyword on its own line marks a batch boundary.
  return content
    .split(/^\s*GO\s*$/gim)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function ensureMigrationsTable(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().query(`
    IF OBJECT_ID('schema_migrations', 'U') IS NULL
    CREATE TABLE schema_migrations (
      filename    NVARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
  `);
}

async function getAppliedMigrations(pool: sql.ConnectionPool): Promise<Set<string>> {
  const result = await pool.request().query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  );
  return new Set(result.recordset.map((r) => r.filename));
}

async function applyMigration(
  pool: sql.ConnectionPool,
  filename: string,
  content: string,
): Promise<void> {
  const batches = splitBatches(content);
  console.log(`  ▶ ${filename} (${batches.length} batch${batches.length === 1 ? '' : 'es'})`);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      await pool.request().batch(batch);
    } catch (err) {
      console.error(`  ✗ ${filename} batch #${i + 1} failed:`);
      console.error(batch.slice(0, 500));
      throw err;
    }
  }
  await pool
    .request()
    .input('filename', sql.NVarChar(255), filename)
    .query('INSERT INTO schema_migrations (filename) VALUES (@filename)');
}

async function main(): Promise<void> {
  // First, ensure the target database itself exists (mdf file).
  console.log('▶ Ensuring database mianliao exists…');
  const adminPool = await new sql.ConnectionPool({
    ...poolConfig,
    database: 'master',
  }).connect();
  try {
    const dbCheck = await adminPool
      .request()
      .input('dbName', sql.NVarChar(128), poolConfig.database!)
      .query<{ name: string }>(
        'SELECT name FROM sys.databases WHERE name = @dbName',
      );
    if (dbCheck.recordset.length === 0) {
      console.log(`  ▶ Creating database ${poolConfig.database}…`);
      await adminPool.request().query(`CREATE DATABASE [${poolConfig.database}]`);
    } else {
      console.log(`  ✓ Database ${poolConfig.database} already exists`);
    }
  } finally {
    await adminPool.close();
  }

  const pool = await getPool();
  await ensureMigrationsTable(pool);

  const applied = await getAppliedMigrations(pool);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('  (no .sql files in migrations/)');
    return;
  }

  let newCount = 0;
  for (const filename of files) {
    if (applied.has(filename)) {
      console.log(`  ✓ ${filename} (already applied)`);
      continue;
    }
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    await applyMigration(pool, filename, content);
    newCount++;
  }

  console.log(`\n✅ Migration complete — ${newCount} new file(s) applied (${files.length - newCount} already up to date)`);
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    closePool().finally(() => process.exit(1));
  });

// src/db/pool.ts
// Single shared mssql connection pool.

import sql from 'mssql';
import { config } from '../config/index.js';

export const poolConfig: sql.config = {
  server: config.db.server,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  options: {
    encrypt: config.db.encrypt,
    trustServerCertificate: config.db.trustServerCertificate,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
};

let _pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (_pool) return _pool;
  _pool = await new sql.ConnectionPool(poolConfig).connect();
  _pool.on('error', (err) => {
    console.error('[mssql] pool error', err);
  });
  return _pool;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.close();
    _pool = null;
  }
}

/** Run a callback with a request attached to a fresh connection from the pool. */
export async function withTransaction<T>(
  fn: (tx: sql.Transaction) => Promise<T>,
): Promise<T> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

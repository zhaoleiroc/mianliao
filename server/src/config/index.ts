// src/config/index.ts
// Centralized env loading + validation. Throws on startup if required vars missing.

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (server/.env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer env var: ${name}=${v}`);
  return n;
}

function csvEnv(name: string, fallback: string[]): string[] {
  const v = process.env[name];
  if (!v || v.trim() === '') return fallback;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function boolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (!v) return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: intEnv('PORT', 5001),
  host: process.env.HOST ?? '0.0.0.0',

  db: {
    server: required('DB_SERVER'),
    port: intEnv('DB_PORT', 1433),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    encrypt: boolEnv('DB_ENCRYPT', false),
    trustServerCertificate: boolEnv('DB_TRUST_CERT', true),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    issuer: process.env.JWT_ISSUER ?? 'mianliao',
    audience: process.env.JWT_AUDIENCE ?? 'mianliao-web',
    accessTtl: intEnv('JWT_ACCESS_TTL', 3600),
    refreshTtl: intEnv('JWT_REFRESH_TTL', 60 * 60 * 24 * 7),
  },

  cors: {
    origins: csvEnv('CORS_ORIGINS', ['http://localhost:5173']),
  },

  upload: {
    maxSize: intEnv('UPLOAD_MAX_SIZE', 5 * 1024 * 1024),
    dir: process.env.UPLOAD_DIR ?? 'wwwroot/uploads',
  },

  seed: {
    adminUsername: process.env.SEED_ADMIN_USERNAME ?? 'admin',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123',
    adminDisplayName: process.env.SEED_ADMIN_DISPLAY_NAME ?? '系统管理员',
  },
} as const;

export type AppConfig = typeof config;

// src/utils/upload.ts
// File upload helpers — sanitize filename, generate relative URL.

import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { config } from '../config/index.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function resolveExt(mime: string): string {
  return ALLOWED_EXT[mime] ?? 'bin';
}

export interface SavedImage {
  /** Path relative to upload dir, e.g. "fabrics/knit/abc12345.png" */
  relativePath: string;
  /** URL path the browser can fetch, e.g. "/uploads/fabrics/knit/abc12345.png" */
  urlPath: string;
  size: number;
  sha1_8: string;
}

export async function saveFabricImage(
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  category: string,
  supplierShortName: string | null,
): Promise<SavedImage> {
  if (!isAllowedImageMime(file.mimetype)) {
    throw new Error(`不支持的图片类型: ${file.mimetype}`);
  }
  if (file.size > config.upload.maxSize) {
    throw new Error(`文件超过最大 ${Math.round(config.upload.maxSize / 1024 / 1024)}MB`);
  }
  const ext = resolveExt(file.mimetype);
  const sha1_8 = crypto.createHash('sha1').update(file.buffer).digest('hex').slice(0, 8);
  const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeSupplier = (supplierShortName ?? 'misc').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${Date.now()}-${sha1_8}.${ext}`;
  const relativePath = path.posix.join('fabrics', safeCategory, safeSupplier, filename);
  const absDir = path.resolve(config.upload.dir, 'fabrics', safeCategory, safeSupplier);
  const absPath = path.resolve(config.upload.dir, relativePath);
  await fs.mkdir(absDir, { recursive: true });
  await fs.writeFile(absPath, file.buffer);
  return {
    relativePath,
    urlPath: `/uploads/${relativePath.split(path.sep).join('/')}`,
    size: file.size,
    sha1_8,
  };
}

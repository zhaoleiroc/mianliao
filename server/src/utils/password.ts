// src/utils/password.ts
// BCrypt password hashing.

import bcrypt from 'bcryptjs';

const COST = 11;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Validate password policy: 8-64 chars, must contain letter and digit.
 * Returns null on success, error message on failure.
 */
export function validatePassword(plain: string): string | null {
  if (!plain) return '密码不能为空';
  if (plain.length < 8) return '密码至少 8 位';
  if (plain.length > 64) return '密码不能超过 64 位';
  if (!/[A-Za-z]/.test(plain)) return '密码必须包含字母';
  if (!/[0-9]/.test(plain)) return '密码必须包含数字';
  return null;
}

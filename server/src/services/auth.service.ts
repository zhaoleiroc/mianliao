// src/services/auth.service.ts
// Auth domain: user lookup, login, refresh, logout.

import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '../utils/jwt.js';
import { config } from '../config/index.js';
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  UserRoleCode,
} from '../types/api.js';
import type { UserRow } from '../types/db.js';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} from '../middleware/error.js';

const REFRESH_DAYS = 7;

function mapUser(row: UserRow & { roles: string }): AuthUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    roles: row.roles
      ? (row.roles.split(',').filter(Boolean) as UserRoleCode[])
      : [],
  };
}

export async function findUserRoles(userId: string): Promise<string[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query<{ code: string }>(
      `SELECT r.code
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = @userId`,
    );
  return result.recordset.map((r) => r.code);
}

export async function findUserByUsername(
  username: string,
): Promise<UserRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('username', sql.NVarChar(64), username)
    .query<UserRow>(
      `SELECT id, username, password_hash, display_name, email,
              is_active, last_login_at, created_at, updated_at
         FROM users
        WHERE username = @username`,
    );
  return result.recordset[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query<UserRow>(
      `SELECT id, username, password_hash, display_name, email,
              is_active, last_login_at, created_at, updated_at
         FROM users
        WHERE id = @id`,
    );
  return result.recordset[0] ?? null;
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const user = await findUserByUsername(input.username);
  if (!user) throw new UnauthorizedError('用户名或密码错误');
  if (!user.is_active) throw new UnauthorizedError('账号已停用');
  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) throw new UnauthorizedError('用户名或密码错误');

  const roles = await findUserRoles(user.id);
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    roles,
  });

  const { token: refreshToken, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.UniqueIdentifier, user.id)
    .input('hash', sql.Char(64), hash)
    .input('expiresAt', sql.DateTime2, expiresAt)
    .query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES (@userId, @hash, @expiresAt)`,
    );

  await pool
    .request()
    .input('id', sql.UniqueIdentifier, user.id)
    .query('UPDATE users SET last_login_at = SYSUTCDATETIME() WHERE id = @id');

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.accessTtl,
    user: mapUser({ ...user, roles: roles.join(',') }),
  };
}

export async function refresh(oldRefreshToken: string): Promise<LoginResponse> {
  const hash = hashRefreshToken(oldRefreshToken);
  const pool = await getPool();
  const found = await pool
    .request()
    .input('hash', sql.Char(64), hash)
    .query<{
      id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, user_id, expires_at, revoked_at
         FROM refresh_tokens
        WHERE token_hash = @hash`,
    );
  const token = found.recordset[0];
  if (!token || token.revoked_at || token.expires_at < new Date()) {
    throw new UnauthorizedError('刷新令牌无效或已过期');
  }

  const user = await findUserById(token.user_id);
  if (!user || !user.is_active) {
    throw new UnauthorizedError('用户不存在或已停用');
  }
  const roles = await findUserRoles(user.id);
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    roles,
  });
  return {
    accessToken,
    refreshToken: oldRefreshToken, // reuse
    expiresIn: config.jwt.accessTtl,
    user: mapUser({ ...user, roles: roles.join(',') }),
  };
}

export async function logout(refreshToken: string): Promise<void> {
  const hash = hashRefreshToken(refreshToken);
  const pool = await getPool();
  await pool
    .request()
    .input('hash', sql.Char(64), hash)
    .query(
      `UPDATE refresh_tokens SET revoked_at = SYSUTCDATETIME()
        WHERE token_hash = @hash AND revoked_at IS NULL`,
    );
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError('用户不存在');
  if (!user.is_active) throw new UnauthorizedError('账号已停用');
  const roles = await findUserRoles(user.id);
  return mapUser({ ...user, roles: roles.join(',') });
}

// ---------- User management (admin) ----------

export interface AdminUserListItem extends AuthUser {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function listUsers(): Promise<AdminUserListItem[]> {
  const pool = await getPool();
  const result = await pool.request().query<UserRow & { roles: string | null }>(
    `SELECT u.id, u.username, u.password_hash, u.display_name, u.email,
            u.is_active, u.last_login_at, u.created_at, u.updated_at,
            STRING_AGG(r.code, ',') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id, u.username, u.password_hash, u.display_name, u.email,
                u.is_active, u.last_login_at, u.created_at, u.updated_at
       ORDER BY u.created_at DESC`,
  );
  return result.recordset.map((row) => ({
    ...mapUser({ ...row, roles: row.roles ?? '' }),
    isActive: row.is_active,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createUser(input: {
  username: string;
  password: string;
  displayName?: string | null;
  email?: string | null;
  roles: UserRoleCode[];
  isActive?: boolean;
}): Promise<AuthUser> {
  const pool = await getPool();
  const existing = await findUserByUsername(input.username);
  if (existing) throw new BadRequestError('用户名已存在');
  const hash = await hashPassword(input.password);

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const insertResult = await tx
      .request()
      .input('username', sql.NVarChar(64), input.username)
      .input('passwordHash', sql.NVarChar(255), hash)
      .input('displayName', sql.NVarChar(64), input.displayName ?? null)
      .input('email', sql.NVarChar(128), input.email ?? null)
      .input('isActive', sql.Bit, input.isActive ?? true)
      .query<{ id: string }>(
        `INSERT INTO users (username, password_hash, display_name, email, is_active)
         OUTPUT INSERTED.id AS id
         VALUES (@username, @passwordHash, @displayName, @email, @isActive)`,
      );
    const userId = insertResult.recordset[0].id;
    if (input.roles.length > 0) {
      const roleReq = tx.request();
      roleReq.input('userId', sql.UniqueIdentifier, userId);
      const values = input.roles
        .map((_, i) => `(@userId, (SELECT id FROM roles WHERE code = @code${i}))`)
        .join(', ');
      input.roles.forEach((code, i) => {
        roleReq.input(`code${i}`, sql.NVarChar(32), code);
      });
      await roleReq.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ${values}`,
      );
    }
    await tx.commit();
    const me = await getMe(userId);
    return me;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function updateUser(
  id: string,
  input: {
    displayName?: string | null;
    email?: string | null;
    roles?: UserRoleCode[];
    isActive?: boolean;
  },
): Promise<AuthUser> {
  const pool = await getPool();
  const user = await findUserById(id);
  if (!user) throw new NotFoundError('用户不存在');

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const sets: string[] = [];
    const req = tx.request();
    req.input('id', sql.UniqueIdentifier, id);
    if (input.displayName !== undefined) {
      sets.push('display_name = @displayName');
      req.input('displayName', sql.NVarChar(64), input.displayName);
    }
    if (input.email !== undefined) {
      sets.push('email = @email');
      req.input('email', sql.NVarChar(128), input.email);
    }
    if (input.isActive !== undefined) {
      sets.push('is_active = @isActive');
      req.input('isActive', sql.Bit, input.isActive);
    }
    if (sets.length > 0) {
      sets.push('updated_at = SYSUTCDATETIME()');
      await req.query(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`);
    }
    if (input.roles) {
      await tx
        .request()
        .input('id', sql.UniqueIdentifier, id)
        .query('DELETE FROM user_roles WHERE user_id = @id');
      if (input.roles.length > 0) {
        const rReq = tx.request();
        rReq.input('id', sql.UniqueIdentifier, id);
        const values = input.roles
          .map((_, i) => `(@id, (SELECT id FROM roles WHERE code = @code${i}))`)
          .join(', ');
        input.roles.forEach((code, i) => {
          rReq.input(`code${i}`, sql.NVarChar(32), code);
        });
        await rReq.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ${values}`,
        );
      }
    }
    await tx.commit();
    return await getMe(id);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  const pool = await getPool();
  const user = await findUserById(id);
  if (!user) throw new NotFoundError('用户不存在');
  const hash = await hashPassword(newPassword);
  await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('hash', sql.NVarChar(255), hash)
    .query(
      `UPDATE users SET password_hash = @hash, updated_at = SYSUTCDATETIME() WHERE id = @id`,
    );
}

export async function deleteUser(id: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query('DELETE FROM users WHERE id = @id');
}

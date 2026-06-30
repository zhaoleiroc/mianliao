// src/services/audit.service.ts
// Append-only audit log.

import sql from 'mssql';
import { getPool } from '../db/pool.js';
import type { AuditAction } from '../types/db.js';

export async function recordAudit(input: {
  userId: string | null;
  username: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', sql.UniqueIdentifier, input.userId)
    .input('username', sql.NVarChar(64), input.username)
    .input('action', sql.NVarChar(32), input.action)
    .input('entityType', sql.NVarChar(32), input.entityType)
    .input('entityId', sql.NVarChar(64), input.entityId)
    .input('beforeValue', sql.NVarChar(sql.MAX),
      input.beforeValue === undefined ? null : JSON.stringify(input.beforeValue))
    .input('afterValue', sql.NVarChar(sql.MAX),
      input.afterValue === undefined ? null : JSON.stringify(input.afterValue))
    .input('ip', sql.NVarChar(45), input.ip)
    .input('userAgent', sql.NVarChar(255), input.userAgent)
    .query(
      `INSERT INTO audit_logs
         (user_id, username, action, entity_type, entity_id,
          before_value, after_value, ip, user_agent)
       VALUES
         (@userId, @username, @action, @entityType, @entityId,
          @beforeValue, @afterValue, @ip, @userAgent)`,
    );
}

export interface AuditQuery {
  user?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listAudits(query: AuditQuery): Promise<{
  items: {
    id: number;
    username: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    beforeValue: unknown;
    afterValue: unknown;
    ip: string | null;
    userAgent: string | null;
    createdAt: string;
  }[];
  total: number;
}> {
  const pool = await getPool();
  const where: string[] = [];
  const req = pool.request();
  if (query.user) {
    where.push('username = @user');
    req.input('user', sql.NVarChar(64), query.user);
  }
  if (query.entityType) {
    where.push('entity_type = @entityType');
    req.input('entityType', sql.NVarChar(32), query.entityType);
  }
  if (query.action) {
    where.push('action = @action');
    req.input('action', sql.NVarChar(32), query.action);
  }
  if (query.from) {
    where.push('created_at >= @from');
    req.input('from', sql.DateTime2, new Date(query.from));
  }
  if (query.to) {
    where.push('created_at <= @to');
    req.input('to', sql.DateTime2, new Date(query.to));
  }
  const whereClause = where.length > 0 ? where.join(' AND ') : '1=1';
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  req.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);

  const totalResult = await pool.request().query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM audit_logs WHERE ${whereClause}`,
  );
  const result = await pool
    .request()
    .input('user', sql.NVarChar(64), query.user ?? null)
    .input('entityType', sql.NVarChar(32), query.entityType ?? null)
    .input('action', sql.NVarChar(32), query.action ?? null)
    .input('from', sql.DateTime2, query.from ? new Date(query.from) : null)
    .input('to', sql.DateTime2, query.to ? new Date(query.to) : null)
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize)
    .query<{
      id: number;
      username: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      before_value: string | null;
      after_value: string | null;
      ip: string | null;
      user_agent: string | null;
      created_at: Date;
    }>(
      `SELECT id, username, action, entity_type, entity_id,
              before_value, after_value, ip, user_agent, created_at
         FROM audit_logs
        WHERE ${whereClause}
        ORDER BY created_at DESC, id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    );
  return {
    items: result.recordset.map((r) => ({
      id: r.id,
      username: r.username,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      beforeValue: r.before_value ? JSON.parse(r.before_value) : null,
      afterValue: r.after_value ? JSON.parse(r.after_value) : null,
      ip: r.ip,
      userAgent: r.user_agent,
      createdAt: r.created_at.toISOString(),
    })),
    total: totalResult.recordset[0].total,
  };
}

// src/middleware/error.ts
// Centralized error handler — converts thrown errors to JSON responses.

import type { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response.js';

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(404, message, 'not_found');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '未登录') {
    super(401, message, 'unauthorized');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '权限不足') {
    super(403, message, 'forbidden');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'bad_request', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'conflict');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body = {
      code: err.status,
      message: err.message,
      data: err.details ?? null,
    };
    res.status(err.status).json(body);
    return;
  }
  console.error('[unhandled error]', err);
  fail(res, 500, '服务器内部错误');
}

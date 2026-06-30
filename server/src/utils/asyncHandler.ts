// src/utils/asyncHandler.ts
// Wrap async route handlers so thrown errors propagate to Express error middleware.

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler<TReq extends Request = Request>(
  fn: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };
}

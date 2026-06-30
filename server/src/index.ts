// src/index.ts
// Main entry: bootstrap Express app.

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { getPool, closePool } from './db/pool.js';
import { errorHandler } from './middleware/error.js';
import { ok, fail } from './utils/response.js';
import authRoutes from './routes/auth.routes.js';
import fabricRoutes from './routes/fabrics.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  // Validate DB connectivity on startup
  const pool = await getPool();
  await pool.request().query('SELECT 1 AS ok');
  console.log(`[db] connected to ${config.db.server}/${config.db.database}`);

  const app = express();

  // Behind a proxy, trust the first hop for X-Forwarded-For
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: (origin, cb) => {
      // allow same-origin (no origin header) and configured origins
      if (!origin) return cb(null, true);
      if (config.cors.origins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS not allowed'), false);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

  // Static uploads
  const uploadsDir = path.resolve(config.upload.dir);
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

  // Root — friendly welcome + endpoint index
  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>面料库 API</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#171717;line-height:1.6}
  h1{font-weight:500;letter-spacing:-0.02em;margin:0 0 8px}
  p{color:#525252;margin:0 0 24px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #f5f5f5;font-weight:400}
  th{color:#737373;font-size:12px;text-transform:uppercase;letter-spacing:0.1em}
  code{font-family:ui-monospace,Menlo,monospace;background:#f5f5f5;padding:1px 6px;border-radius:3px;font-size:13px}
  a{color:#171717}
  .pill{display:inline-block;padding:2px 8px;background:#f5f5f5;border-radius:99px;font-size:11px;color:#525252;margin-left:8px}
</style></head><body>
  <h1>面料库 API <span class="pill">${config.env}</span></h1>
  <p>服务运行中。前端：<a href="http://localhost:5173">http://localhost:5173</a></p>
  <h2 style="font-size:14px;margin:24px 0 8px;font-weight:500">主要端点</h2>
  <table>
    <tr><th>方法</th><th>路径</th><th>说明</th></tr>
    <tr><td>GET</td><td><a href="/api/health"><code>/api/health</code></a></td><td>健康检查</td></tr>
    <tr><td>POST</td><td><code>/api/auth/login</code></td><td>登录 (账号密码)</td></tr>
    <tr><td>GET</td><td><code>/api/auth/me</code></td><td>当前用户（需 Bearer Token）</td></tr>
    <tr><td>GET</td><td><code>/api/fabrics</code></td><td>面料列表（分页/过滤/搜索/排序）</td></tr>
    <tr><td>GET</td><td><code>/api/fabrics/{id}</code></td><td>面料详情</td></tr>
    <tr><td>GET</td><td><code>/api/fabrics/{id}/similar</code></td><td>相似款</td></tr>
    <tr><td>GET</td><td><code>/api/fabrics/_/dictionaries</code></td><td>字典全集</td></tr>
    <tr><td>GET</td><td><code>/api/admin/dashboard</code></td><td>后台仪表盘（需 Bearer Token + 角色）</td></tr>
    <tr><td>GET</td><td><code>/api/admin/fabrics</code></td><td>后台面料列表</td></tr>
    <tr><td>POST</td><td><code>/api/admin/fabrics</code></td><td>新建面料</td></tr>
    <tr><td>POST</td><td><code>/api/admin/fabrics/import</code></td><td>批量导入 CSV/XLSX</td></tr>
  </table>
</body></html>`);
  });

  // Health
  app.get('/api/health', (_req, res) => {
    ok(res, { status: 'ok', service: 'mianliao-api', time: new Date().toISOString() });
  });

  // Public API
  app.use('/api/auth', authRoutes);
  app.use('/api/fabrics', fabricRoutes);

  // Admin API
  app.use('/api/admin', adminRoutes);

  // 404
  app.use((_req, res) => {
    fail(res, 404, '接口不存在');
  });

  // Error handler
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof Error && err.message === 'CORS not allowed') {
      return fail(res, 403, 'CORS not allowed');
    }
    return errorHandler(err, req, res, next);
  });

  app.listen(config.port, config.host, () => {
    console.log(`[api] listening on http://${config.host}:${config.port}  (env=${config.env})`);
    console.log(`[api] CORS origins: ${config.cors.origins.join(', ')}`);
    console.log(`[api] Swagger: not yet — see /api/health for liveness`);
  });
}

main().catch((err) => {
  console.error('[fatal] failed to start:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[shutdown] SIGINT received');
  await closePool();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  console.log('\n[shutdown] SIGTERM received');
  await closePool();
  process.exit(0);
});

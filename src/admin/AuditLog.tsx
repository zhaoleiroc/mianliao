// src/admin/AuditLog.tsx
// Audit log viewer with filters and pagination.

import { useEffect, useState } from 'react';
import { adminListAudits, type AuditEntry, type AuditQueryParams } from '../api/admin';

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700 border-green-200',
  UPDATE: 'bg-amber-50 text-amber-700 border-amber-200',
  STATUS_CHANGE: 'bg-blue-50 text-blue-700 border-blue-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  LOGIN: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  LOGOUT: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  IMPORT: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function AuditLog() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [q, setQ] = useState<AuditQueryParams>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const r = await adminListAudits({ ...q, page, pageSize });
      setItems(r.items);
      setTotal(r.total);
    } catch (e: any) {
      setError(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [page]);

  function onFilter(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">审计日志</h1>
      <form onSubmit={onFilter} className="flex flex-wrap gap-2 items-end">
        <label className="block">
          <span className="text-xs text-neutral-600">操作者</span>
          <input value={q.user ?? ''} onChange={(e) => setQ({ ...q, user: e.target.value || undefined })} className="block w-32 px-2 py-1 text-sm border border-neutral-300" />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-600">对象类型</span>
          <input value={q.entityType ?? ''} onChange={(e) => setQ({ ...q, entityType: e.target.value || undefined })} className="block w-32 px-2 py-1 text-sm border border-neutral-300" />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-600">动作</span>
          <select value={q.action ?? ''} onChange={(e) => setQ({ ...q, action: e.target.value || undefined })} className="block px-2 py-1 text-sm border border-neutral-300">
            <option value="">全部</option>
            <option>CREATE</option>
            <option>UPDATE</option>
            <option>DELETE</option>
            <option>STATUS_CHANGE</option>
            <option>LOGIN</option>
            <option>LOGOUT</option>
            <option>IMPORT</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-neutral-600">起始</span>
          <input type="datetime-local" value={q.from ?? ''} onChange={(e) => setQ({ ...q, from: e.target.value || undefined })} className="block px-2 py-1 text-sm border border-neutral-300" />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-600">截止</span>
          <input type="datetime-local" value={q.to ?? ''} onChange={(e) => setQ({ ...q, to: e.target.value || undefined })} className="block px-2 py-1 text-sm border border-neutral-300" />
        </label>
        <button type="submit" className="px-3 py-1 text-sm border border-neutral-300 hover:bg-neutral-100">查询</button>
        <div className="ml-auto text-xs text-neutral-500">共 {total} 条</div>
      </form>

      {error && <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}

      <div className="border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-neutral-500 border-b border-neutral-200">
              <th className="px-4 py-2 font-normal w-44">时间</th>
              <th className="py-2 font-normal w-24">操作者</th>
              <th className="py-2 font-normal w-24">动作</th>
              <th className="py-2 font-normal">对象</th>
              <th className="py-2 font-normal w-20 text-right">详情</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">加载中…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">无数据</td></tr>
            ) : items.map((it) => {
              const isOpen = expanded === it.id;
              return (
                <>
                  <tr key={it.id} className="border-b border-neutral-100">
                    <td className="px-4 py-2 text-xs text-neutral-500 tabular-nums">
                      {new Date(it.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 text-neutral-700">{it.username ?? '-'}</td>
                    <td className="py-2">
                      <span className={`inline-block px-1.5 py-0.5 text-xs border ${ACTION_COLOR[it.action] ?? 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
                        {it.action}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-neutral-500">
                      {it.entityType}{it.entityId ? ` · ${it.entityId.slice(0, 20)}` : ''}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => setExpanded(isOpen ? null : it.id)}
                        className="px-2 py-0.5 text-xs border border-neutral-300 hover:bg-neutral-100"
                      >
                        {isOpen ? '收起' : '展开'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-neutral-50">
                      <td colSpan={5} className="px-4 py-3 text-xs">
                        {it.beforeValue != null && (
                          <div className="mb-2">
                            <div className="text-neutral-500 mb-1">Before</div>
                            <pre className="bg-white p-2 border border-neutral-200 overflow-auto max-h-40">{JSON.stringify(it.beforeValue, null, 2)}</pre>
                          </div>
                        )}
                        {it.afterValue != null && (
                          <div>
                            <div className="text-neutral-500 mb-1">After</div>
                            <pre className="bg-white p-2 border border-neutral-200 overflow-auto max-h-40">{JSON.stringify(it.afterValue, null, 2)}</pre>
                          </div>
                        )}
                        <div className="mt-2 text-neutral-400">IP: {it.ip ?? '-'} · UA: {it.userAgent ?? '-'}</div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <div>第 {page} / {Math.ceil(total / pageSize)} 页</div>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-neutral-300 disabled:opacity-30">上一页</button>
            <button disabled={page * pageSize >= total} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-neutral-300 disabled:opacity-30">下一页</button>
          </div>
        </div>
      )}
    </div>
  );
}

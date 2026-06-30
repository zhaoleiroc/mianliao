// src/admin/FabricList.tsx
// Admin fabric list with search, filter, status change, delete.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  adminListFabrics,
  adminChangeStatus,
  adminDeleteFabric,
} from '../api/admin';
import { fetchDictionaries, imageUrl } from '../api/fabrics';
import { CATEGORY_LABEL, type DictionaryBundle, type FabricListItemDto, type FabricStatus } from '../types';
import { useAuth } from '../auth/AuthContext';

const STATUS_LABEL: Record<FabricStatus, string> = {
  active: '在售',
  inactive: '下架',
  draft: '草稿',
};
const STATUS_COLOR: Record<FabricStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function FabricList() {
  const { hasRole } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<FabricListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');
  const [status, setStatus] = useState<'' | FabricStatus>('');
  const [bundle, setBundle] = useState<DictionaryBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDictionaries().then(setBundle).catch(() => {});
  }, []);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const r = await adminListFabrics({
        q: q || undefined,
        category: category || undefined,
        status: status || undefined,
        page,
        pageSize,
      });
      setItems(r.items);
      setTotal(r.total);
    } catch (e: any) {
      setError(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, category, status]);

  async function onStatusChange(id: string, newStatus: FabricStatus) {
    try {
      await adminChangeStatus(id, newStatus);
      reload();
    } catch (e: any) {
      alert(e?.message ?? '操作失败');
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`确认删除面料「${name}」？此操作不可撤销。`)) return;
    try {
      await adminDeleteFabric(id);
      reload();
    } catch (e: any) {
      alert(e?.message ?? '删除失败');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">面料管理</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/fabrics/import"
            className="px-3 py-1.5 text-sm border border-neutral-300 hover:bg-neutral-100"
          >
            批量导入
          </Link>
          <Link
            to="/admin/fabrics/new"
            className="px-3 py-1.5 text-sm bg-neutral-900 text-white hover:bg-neutral-700"
          >
            + 新增面料
          </Link>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), reload())}
          placeholder="搜索名称 / 编号"
          className="px-3 py-1.5 text-sm border border-neutral-300 w-56"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-2 py-1.5 text-sm border border-neutral-300"
        >
          <option value="">全部品类</option>
          {bundle?.categories.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}
          className="px-2 py-1.5 text-sm border border-neutral-300"
        >
          <option value="">全部状态</option>
          <option value="active">在售</option>
          <option value="inactive">下架</option>
          <option value="draft">草稿</option>
        </select>
        <button onClick={() => { setPage(1); reload(); }} className="px-3 py-1.5 text-sm border border-neutral-300 hover:bg-neutral-100">
          搜索
        </button>
        <div className="ml-auto text-xs text-neutral-500">
          共 {total} 条
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}

      <div className="border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-neutral-500 border-b border-neutral-200">
              <th className="px-4 py-2 font-normal w-16">图</th>
              <th className="py-2 font-normal">名称 / 编号</th>
              <th className="py-2 font-normal">品类</th>
              <th className="py-2 font-normal">供应商</th>
              <th className="py-2 font-normal text-right">克重</th>
              <th className="py-2 font-normal text-right">价格</th>
              <th className="py-2 font-normal">状态</th>
              <th className="py-2 font-normal text-right w-44">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-neutral-500">加载中…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-neutral-500">无数据</td></tr>
            ) : items.map((f) => {
              const cover = imageUrl(f.coverImageUrl);
              return (
                <tr key={f.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    {cover ? (
                      <img src={cover} alt={f.name} className="w-10 h-10 object-cover bg-neutral-100" />
                    ) : (
                      <div className="w-10 h-10 bg-neutral-100" />
                    )}
                  </td>
                  <td className="py-2">
                    <div className="font-medium text-neutral-900">{f.name}</div>
                    <div className="text-xs text-neutral-500 tabular-nums">{f.code ?? '-'}</div>
                  </td>
                  <td className="py-2 text-neutral-700">{f.categoryLabel}</td>
                  <td className="py-2 text-neutral-700 text-xs">{f.supplierName ?? '-'}</td>
                  <td className="py-2 text-right tabular-nums">{f.weightGsm != null ? `${f.weightGsm}` : '-'}</td>
                  <td className="py-2 text-right tabular-nums">{f.priceRmbPerM != null ? `¥${f.priceRmbPerM}` : '-'}</td>
                  <td className="py-2">
                    <span className={`inline-block px-1.5 py-0.5 text-xs border ${STATUS_COLOR[f.status]}`}>
                      {STATUS_LABEL[f.status]}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex gap-1 text-xs">
                      <button onClick={() => nav(`/admin/fabrics/${f.id}/edit`)} className="px-2 py-0.5 border border-neutral-300 hover:bg-neutral-100">
                        编辑
                      </button>
                      {f.status === 'active' ? (
                        <button onClick={() => onStatusChange(f.id, 'inactive')} className="px-2 py-0.5 border border-neutral-300 hover:bg-neutral-100">
                          下架
                        </button>
                      ) : (
                        <button onClick={() => onStatusChange(f.id, 'active')} className="px-2 py-0.5 border border-neutral-300 hover:bg-neutral-100">
                          上架
                        </button>
                      )}
                      {hasRole('admin') && (
                        <button onClick={() => onDelete(f.id, f.name)} className="px-2 py-0.5 border border-red-200 text-red-700 hover:bg-red-50">
                          删
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <div>第 {page} / {Math.ceil(total / pageSize)} 页</div>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-neutral-300 disabled:opacity-30">
              上一页
            </button>
            <button disabled={page * pageSize >= total} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-neutral-300 disabled:opacity-30">
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// src/admin/DictManager.tsx
// Generic dictionary manager. URL: /admin/dict/:type (e.g. seasons, garment_styles, feature_tags, finishes).

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  adminListDict,
  adminCreateDictItem,
  adminUpdateDictItem,
  adminDeleteDictItem,
  type DictRow,
} from '../api/admin';

const TYPE_LABEL: Record<string, string> = {
  categories: '品类',
  seasons: '季节',
  garment_styles: '推荐款式',
  feature_tags: '特性标签',
  finishes: '后整理',
  suppliers: '供应商',
};

export default function DictManager() {
  const { type = '' } = useParams();
  const [items, setItems] = useState<DictRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const label = TYPE_LABEL[type] ?? type;

  async function reload() {
    if (type === 'suppliers') return; // not a code/label table
    setLoading(true);
    setError(null);
    try {
      const list = await adminListDict(type);
      setItems(list);
    } catch (e: any) {
      setError(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode.trim() || !newLabel.trim()) return;
    try {
      await adminCreateDictItem(type, { code: newCode.trim(), nameZh: newLabel.trim() });
      setNewCode('');
      setNewLabel('');
      reload();
    } catch (e: any) {
      alert(e?.message ?? '新增失败');
    }
  }

  async function onRename(code: string, nameZh: string) {
    const next = prompt(`重命名 ${code}`, nameZh);
    if (next == null || next === nameZh) return;
    try {
      await adminUpdateDictItem(type, code, { nameZh: next });
      reload();
    } catch (e: any) {
      alert(e?.message ?? '更新失败');
    }
  }

  async function onDelete(code: string) {
    if (!confirm(`确认删除「${code}」？已有引用会失败。`)) return;
    try {
      await adminDeleteDictItem(type, code);
      reload();
    } catch (e: any) {
      alert(e?.message ?? '删除失败');
    }
  }

  if (type === 'suppliers') {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-medium">{label}</h1>
        <p className="text-sm text-neutral-500">供应商管理（请到 <Link to="/admin/dict/categories" className="underline">字典</Link> 切换其他类型；供应商 CRUD 在「用户」菜单下扩展）</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-medium">{label}</h1>
      {error && (
        <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>
      )}

      <form onSubmit={onAdd} className="flex gap-2">
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="编码"
          className="w-32 px-3 py-1.5 text-sm border border-neutral-300"
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="中文名"
          className="flex-1 px-3 py-1.5 text-sm border border-neutral-300"
        />
        <button type="submit" className="px-4 py-1.5 text-sm bg-neutral-900 text-white hover:bg-neutral-700">
          新增
        </button>
      </form>

      <div className="border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-neutral-500 border-b border-neutral-200">
              <th className="px-4 py-2 font-normal w-1/3">编码</th>
              <th className="py-2 font-normal">中文名</th>
              <th className="py-2 font-normal w-1/6">排序</th>
              <th className="py-2 font-normal text-right w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-500">加载中…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-500">无数据</td></tr>
            ) : items.map((it) => (
              <tr key={it.code} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 tabular-nums text-xs text-neutral-500">{it.code}</td>
                <td className="py-2">{it.label}</td>
                <td className="py-2 tabular-nums text-xs text-neutral-500">{it.sortOrder}</td>
                <td className="py-2 text-right">
                  <button onClick={() => onRename(it.code, it.label)} className="px-2 py-0.5 text-xs border border-neutral-300 hover:bg-neutral-100 mr-1">
                    改名
                  </button>
                  <button onClick={() => onDelete(it.code)} className="px-2 py-0.5 text-xs border border-red-200 text-red-700 hover:bg-red-50">
                    删
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

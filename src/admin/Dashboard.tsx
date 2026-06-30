// src/admin/Dashboard.tsx
// Top-level stats + recent activity.

import { useEffect, useState } from 'react';
import { fetchDashboard } from '../api/admin';
import type { DashboardStats } from '../types';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-neutral-200 bg-white p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-medium tabular-nums text-neutral-900">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setStats)
      .catch((e) => setError(e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">加载中…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-medium">仪表盘</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="面料总数" value={stats.totalFabrics} />
        <Stat label="在售" value={stats.activeFabrics} />
        <Stat label="草稿" value={stats.draftFabrics} />
        <Stat label="近 7 日新增" value={stats.newLast7Days} />
        <Stat label="供应商" value={stats.totalSuppliers} />
        <Stat label="用户" value={stats.totalUsers} />
        <Stat label="已下架" value={stats.inactiveFabrics} />
      </div>

      <div className="border border-neutral-200 bg-white">
        <div className="px-5 py-3 border-b border-neutral-200 text-sm font-medium">最近活动</div>
        {stats.recentAudits.length === 0 ? (
          <div className="px-5 py-8 text-sm text-neutral-500 text-center">暂无活动</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-neutral-500 border-b border-neutral-200">
                <th className="px-5 py-2 font-normal">时间</th>
                <th className="py-2 font-normal">操作者</th>
                <th className="py-2 font-normal">动作</th>
                <th className="py-2 font-normal">对象</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentAudits.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-5 py-2 text-xs text-neutral-500 tabular-nums">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 text-neutral-700">{a.username ?? '-'}</td>
                  <td className="py-2">
                    <span className="inline-block px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-700">
                      {a.action}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-neutral-500">
                    {a.entityType}{a.entityId ? ` · ${a.entityId.slice(0, 12)}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

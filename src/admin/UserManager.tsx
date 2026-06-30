// src/admin/UserManager.tsx
// User CRUD + role management.

import { useEffect, useState } from 'react';
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminResetPassword,
  adminDeleteUser,
} from '../api/admin';
import type { AdminUserDto, UserRoleCode } from '../types';

const ROLES: UserRoleCode[] = ['admin', 'purchaser', 'viewer'];
const ROLE_LABEL: Record<UserRoleCode, string> = {
  admin: '管理员',
  purchaser: '采购',
  viewer: '访客',
};

export default function UserManager() {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await adminListUsers());
    } catch (e: any) {
      setError(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function onToggleActive(u: AdminUserDto) {
    try {
      await adminUpdateUser(u.id, { isActive: !u.isActive });
      reload();
    } catch (e: any) { alert(e?.message ?? '失败'); }
  }

  async function onChangeRoles(u: AdminUserDto, roles: UserRoleCode[]) {
    try {
      await adminUpdateUser(u.id, { roles });
      reload();
    } catch (e: any) { alert(e?.message ?? '失败'); }
  }

  async function onResetPassword(u: AdminUserDto) {
    const np = prompt(`重置「${u.username}」的密码（≥8 位，含字母与数字）`);
    if (!np) return;
    try {
      await adminResetPassword(u.id, np);
      alert('密码已重置');
    } catch (e: any) { alert(e?.message ?? '失败'); }
  }

  async function onDelete(u: AdminUserDto) {
    if (!confirm(`确认删除用户「${u.username}」？`)) return;
    try {
      await adminDeleteUser(u.id);
      reload();
    } catch (e: any) { alert(e?.message ?? '失败'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">用户管理</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="px-3 py-1.5 text-sm bg-neutral-900 text-white hover:bg-neutral-700">
          {showCreate ? '取消' : '+ 新建用户'}
        </button>
      </div>

      {showCreate && <CreateUserForm onCreated={() => { setShowCreate(false); reload(); }} />}

      {error && <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}

      <div className="border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-neutral-500 border-b border-neutral-200">
              <th className="px-4 py-2 font-normal">用户名</th>
              <th className="py-2 font-normal">显示名</th>
              <th className="py-2 font-normal">角色</th>
              <th className="py-2 font-normal">状态</th>
              <th className="py-2 font-normal">最近登录</th>
              <th className="py-2 font-normal text-right w-44">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">加载中…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">无用户</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2 font-medium">{u.username}</td>
                <td className="py-2 text-neutral-700">{u.displayName ?? '-'}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {ROLES.map((r) => {
                      const on = u.roles.includes(r);
                      return (
                        <button
                          key={r}
                          onClick={() => onChangeRoles(u, on ? u.roles.filter((x) => x !== r) : [...u.roles, r])}
                          className={`px-1.5 py-0.5 text-xs border ${on ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-700'}`}
                        >
                          {ROLE_LABEL[r]}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="py-2">
                  <button
                    onClick={() => onToggleActive(u)}
                    className={`px-2 py-0.5 text-xs border ${u.isActive ? 'border-green-200 text-green-700 bg-green-50' : 'border-neutral-300 text-neutral-500'}`}
                  >
                    {u.isActive ? '启用' : '已停用'}
                  </button>
                </td>
                <td className="py-2 text-xs text-neutral-500 tabular-nums">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '-'}
                </td>
                <td className="py-2 text-right">
                  <div className="inline-flex gap-1 text-xs">
                    <button onClick={() => onResetPassword(u)} className="px-2 py-0.5 border border-neutral-300 hover:bg-neutral-100">
                      重置密码
                    </button>
                    <button onClick={() => onDelete(u)} className="px-2 py-0.5 border border-red-200 text-red-700 hover:bg-red-50">
                      删
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<UserRoleCode[]>(['viewer']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminCreateUser({ username, password, displayName: displayName || null, email: email || null, roles });
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? '创建失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-neutral-200 bg-white p-5 space-y-3">
      <h2 className="text-sm font-medium">新建用户</h2>
      {error && <div className="text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名 *（3-64 位）" required minLength={3} className="px-3 py-1.5 text-sm border border-neutral-300" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码 *（≥8 位，含字母与数字）" required minLength={8} type="password" className="px-3 py-1.5 text-sm border border-neutral-300" />
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="显示名" className="px-3 py-1.5 text-sm border border-neutral-300" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" type="email" className="px-3 py-1.5 text-sm border border-neutral-300" />
      </div>
      <div className="flex gap-2 items-center text-sm">
        <span className="text-neutral-600">角色：</span>
        {ROLES.map((r) => {
          const on = roles.includes(r);
          return (
            <button
              type="button"
              key={r}
              onClick={() => setRoles(on ? roles.filter((x) => x !== r) : [...roles, r])}
              className={`px-2 py-0.5 text-xs border ${on ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300'}`}
            >
              {ROLE_LABEL[r]}
            </button>
          );
        })}
      </div>
      <div>
        <button type="submit" disabled={submitting} className="px-4 py-1.5 text-sm bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50">
          {submitting ? '创建中…' : '创建'}
        </button>
      </div>
    </form>
  );
}

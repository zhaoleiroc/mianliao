// src/admin/AdminLayout.tsx
// Sidebar + topbar shell for /admin/* routes.

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/admin', label: '仪表盘', icon: '▦', end: true },
  { to: '/admin/fabrics', label: '面料', icon: '▤' },
  { to: '/admin/fabrics/import', label: '批量导入', icon: '↑' },
  { to: '/admin/dict/categories', label: '字典', icon: '☰' },
  { to: '/admin/users', label: '用户', icon: '◉', adminOnly: true },
  { to: '/admin/audit', label: '审计', icon: '⏱', adminOnly: true },
];

export default function AdminLayout() {
  const { user, logout, hasRole } = useAuth();
  const nav = useNavigate();

  async function onLogout() {
    await logout();
    nav('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex">
      <aside className="w-52 flex-none border-r border-neutral-200 bg-white">
        <div className="px-5 py-5 border-b border-neutral-200">
          <Link to="/" className="text-sm font-medium tracking-tight">
            面料库 · 后台
          </Link>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV_ITEMS.filter((it) => !it.adminOnly || hasRole('admin')).map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded text-sm transition ${
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`
              }
            >
              <span className="w-4 text-center text-xs opacity-70">{it.icon}</span>
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-neutral-200 bg-white">
          <div className="flex items-center justify-between px-8 py-3">
            <div className="text-sm text-neutral-500">欢迎，{user?.displayName ?? user?.username}</div>
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <span>角色：{user?.roles.join(', ') ?? '-'}</span>
              <button onClick={onLogout} className="text-neutral-700 hover:text-neutral-900 underline-offset-4 hover:underline">
                退出
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

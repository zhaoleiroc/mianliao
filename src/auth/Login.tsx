// src/auth/Login.tsx
// Login page — bare, Tailwind-styled form. No external UI lib.

import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/admin';
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      nav(from, { replace: true });
    } catch (err: any) {
      setError(err?.message ?? '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white p-8 rounded-lg border border-neutral-200 shadow-sm"
      >
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">面料库 · 后台登录</h1>
          <p className="text-sm text-neutral-500 mt-1">使用管理员账号登录</p>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}

        <label className="block mb-3">
          <span className="text-xs text-neutral-600 tracking-wider">用户名</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
          />
        </label>
        <label className="block mb-5">
          <span className="text-xs text-neutral-600 tracking-wider">密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-neutral-900"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-neutral-900 text-white text-sm tracking-wider rounded hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? '登录中…' : '登录'}
        </button>

        <div className="mt-4 text-xs text-neutral-400 text-center">
          默认账号 <code className="bg-neutral-100 px-1.5 py-0.5 rounded">admin</code> / <code className="bg-neutral-100 px-1.5 py-0.5 rounded">Admin@123</code>
        </div>
      </form>
    </div>
  );
}

// src/auth/RequireAuth.tsx
// Route guard: redirect to /admin/login if not authenticated, or 403 if role mismatch.

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { ReactNode } from 'react';
import type { UserRoleCode } from '../types/api';

export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode;
  role?: UserRoleCode | UserRoleCode[];
}) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">
        加载中…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />;
  }
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!user.roles.some((r) => allowed.includes(r))) {
      return (
        <div className="min-h-screen flex items-center justify-center text-sm text-neutral-700">
          <div className="text-center">
            <div className="text-3xl font-light text-neutral-300 mb-2">403</div>
            <div>权限不足：当前账号不能访问此页面</div>
            <a href="/admin" className="text-neutral-500 underline mt-3 inline-block">返回仪表盘</a>
          </div>
        </div>
      );
    }
  }
  return <>{children}</>;
}

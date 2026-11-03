'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hasAnyPermission, ROUTE_PERMISSIONS, ROUTE_ROLES } from '@/lib/auth';
import { useAuth } from '@/components/auth/auth-provider';

export function AppRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isReady } = useAuth();
  const requiredPermissions = ROUTE_PERMISSIONS[pathname];
  const allowedRoles = ROUTE_ROLES[pathname];
  const isAllowed =
    session !== null &&
    requiredPermissions !== undefined &&
    (!allowedRoles || allowedRoles.includes(session.user.role)) &&
    hasAnyPermission(session.user.permissions, requiredPermissions);

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      router.replace('/login');
    } else if (!isAllowed) {
      router.replace('/acceso-denegado');
    }
  }, [isAllowed, isReady, router, session]);

  if (!isReady || !session || !isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Verificando sesión y permisos...
      </div>
    );
  }

  return children;
}

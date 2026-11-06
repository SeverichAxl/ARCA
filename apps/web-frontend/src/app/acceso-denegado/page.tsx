'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { hasAnyPermission, ROUTE_PERMISSIONS } from '@/lib/auth';

export default function AccessDeniedPage() {
  const { isReady, session } = useAuth();
  const allowedPath = session
    ? Object.entries(ROUTE_PERMISSIONS).find(([, permissions]) =>
        hasAnyPermission(session.user.permissions, permissions),
      )?.[0]
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Acceso no autorizado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Tu rol no tiene permisos para ver esta sección. Si necesitas acceso, contacta al
            administrador del sistema.
          </p>
        </div>
        {!isReady ? (
          <p className="text-sm text-slate-500">Verificando tu sesión...</p>
        ) : (
          <Button asChild className="w-full">
            <Link href={allowedPath ?? '/login'}>
              {allowedPath ? 'Ir a una sección permitida' : 'Volver al inicio de sesión'}
            </Link>
          </Button>
        )}
      </div>
    </main>
  );
}

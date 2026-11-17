'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from '@/components/theme/theme-switch';
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
    <main className="relative flex min-h-screen items-center justify-center bg-background px-6">
      <div className="absolute right-5 top-5 z-20 sm:right-7 sm:top-7">
        <ThemeSwitch withLabel />
      </div>
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 text-center shadow-[0_30px_70px_-50px_rgba(0,0,0,0.95)]">
        <ShieldAlert className="mx-auto h-12 w-12 text-[hsl(var(--warning))]" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acceso no autorizado</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tu rol no tiene permisos para ver esta sección. Si necesitas acceso, contacta al
            administrador del sistema.
          </p>
        </div>
        {!isReady ? (
          <p className="text-sm text-muted-foreground">Verificando tu sesión...</p>
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

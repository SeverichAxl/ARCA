'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ROLE_LABELS } from '@/lib/auth';
import { useAuth } from '@/components/auth/auth-provider';

export function SessionUser() {
  const router = useRouter();
  const { session, logout } = useAuth();

  if (!session) return null;

  const initials = session.user.username.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-secondary/30 bg-secondary/15 text-xs font-semibold text-secondary">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium text-foreground">{session.user.username}</span>
          <span className="block text-xs text-muted-foreground">
            {ROLE_LABELS[session.user.role]}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex h-9 items-center gap-2 rounded-[4px] border border-border px-3 text-sm text-muted-foreground transition hover:border-secondary/40 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </div>
  );
}

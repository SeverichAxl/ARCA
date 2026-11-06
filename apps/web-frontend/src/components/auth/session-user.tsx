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
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium text-slate-900">
            {session.user.username}
          </span>
          <span className="block text-xs text-slate-500">
            {ROLE_LABELS[session.user.role]}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </div>
  );
}

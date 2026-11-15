import Image from 'next/image';
import { Bell, Search } from 'lucide-react';
import { AppRouteGuard } from '@/components/auth/app-route-guard';
import { SessionUser } from '@/components/auth/session-user';
import { AppSidebar } from '@/components/app-sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppRouteGuard>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#0b0714]/95 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3 md:hidden">
              <Image
                src="/ARCA-logo.png"
                alt="ARCA Ltda."
                width={1408}
                height={768}
                priority
                className="h-7 w-auto brightness-0 invert"
              />
            </div>

            <div className="hidden flex-1 items-center gap-6 sm:flex lg:max-w-md">
              <span className="eyebrow hidden whitespace-nowrap text-[10px] text-slate-400 lg:block">Sistema / ARCA</span>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  aria-label="Buscar en el sistema"
                  placeholder="Buscar en el sistema"
                  className="h-9 w-full rounded-[4px] border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-violet-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/25"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Notificaciones"
                className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-white/10 text-slate-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
              >
                <Bell className="h-4 w-4" />
              </button>
              <SessionUser />
            </div>
          </header>

          <main className="app-surface flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </AppRouteGuard>
  );
}

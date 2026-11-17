'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronRight, Sparkles } from 'lucide-react';
import { SessionUser } from '@/components/auth/session-user';
import { MobileSidebar } from '@/components/app-sidebar';
import { ThemeSwitch } from '@/components/theme/theme-switch';
import { getBreadcrumbs } from '@/lib/navigation';
import { cn } from '@/lib/utils';

function trackGlow(event: React.PointerEvent<HTMLElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  target.style.setProperty('--glow-x', `${event.clientX - rect.left}px`);
  target.style.setProperty('--glow-y', `${event.clientY - rect.top}px`);
}

const GLOW_LAYER =
  'pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100';

const GLOW_BACKGROUND =
  'radial-gradient(140px circle at var(--glow-x, 50%) var(--glow-y, 50%), hsl(var(--violet-400) / 0.24), transparent 72%)';

export function AppHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const crumbs = getBreadcrumbs(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out',
        scrolled
          ? 'border-white/10 bg-background/80 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-5 lg:px-7">
        <MobileSidebar />

        <Link
          href="/dashboard"
          aria-label="ARCA · Ir al dashboard"
          className="group relative -ml-1 flex shrink-0 items-center rounded-lg px-2 py-1.5 transition-transform duration-300 hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Image
            src="/ARCA-logo.png"
            alt="ARCA Ltda."
            width={1408}
            height={768}
            priority
            className="arca-logo h-8 w-auto drop-shadow-[0_0_18px_hsl(var(--violet-400)/0.25)] sm:h-9"
          />
        </Link>

        <span aria-hidden="true" className="hidden h-6 w-px bg-white/10 sm:block" />

        <nav aria-label="Ubicación actual" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li
                  key={`${crumb.label}-${index}`}
                  className={cn('flex min-w-0 items-center gap-1.5', !isLast && 'hidden sm:flex')}
                >
                  {index > 0 ? (
                    <ChevronRight
                      aria-hidden="true"
                      className="hidden h-3 w-3 shrink-0 text-slate-600 sm:block"
                    />
                  ) : null}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      onPointerMove={trackGlow}
                      className="group relative isolate inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 font-medium text-slate-400 transition-colors duration-200 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <span
                        aria-hidden="true"
                        className={GLOW_LAYER}
                        style={{ background: GLOW_BACKGROUND }}
                      />
                      {index === 0 ? (
                        <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-violet-300/80" />
                      ) : null}
                      <span className="relative z-10 whitespace-nowrap">{crumb.label}</span>
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        'truncate',
                        isLast
                          ? 'font-semibold tracking-[-0.01em] text-white'
                          : 'text-slate-400',
                      )}
                      title={crumb.label}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeSwitch className="mr-0.5" />
          <button
            type="button"
            aria-label="Notificaciones"
            onPointerMove={trackGlow}
            className="group relative isolate flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-400/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <span
              aria-hidden="true"
              className={GLOW_LAYER}
              style={{ background: GLOW_BACKGROUND }}
            />
            <Bell aria-hidden="true" className="relative z-10 h-4 w-4" />
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 z-10 h-1.5 w-1.5 rounded-full bg-violet-400"
              style={{ boxShadow: '0 0 8px hsl(var(--violet-400) / 0.95)' }}
            />
          </button>
          <SessionUser />
        </div>
      </div>
    </header>
  );
}

'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeSwitch({
  withLabel = false,
  className,
}: {
  withLabel?: boolean;
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'Cambiar al modo oscuro' : 'Cambiar al modo claro'}
      title={isLight ? 'Cambiar al modo oscuro' : 'Cambiar al modo claro'}
      onClick={toggleTheme}
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-full text-slate-400 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      {withLabel ? (
        <span className="hidden text-[11px] font-medium tracking-[0.02em] sm:inline">
          {isLight ? 'Modo claro' : 'Modo oscuro'}
        </span>
      ) : null}

      <span className="theme-switch-track relative inline-flex h-7 w-[52px] shrink-0 items-center rounded-full border p-1 transition-colors duration-300">
        <Sun
          aria-hidden="true"
          className={cn(
            'absolute left-1.5 h-3 w-3 transition-opacity duration-300',
            isLight ? 'opacity-30' : 'opacity-60',
          )}
        />
        <Moon
          aria-hidden="true"
          className={cn(
            'absolute right-1.5 h-3 w-3 transition-opacity duration-300',
            isLight ? 'opacity-60' : 'opacity-30',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_3px_10px_-2px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out',
            isLight ? 'translate-x-0' : 'translate-x-[24px]',
          )}
        >
          {isLight ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
        </span>
      </span>
    </button>
  );
}

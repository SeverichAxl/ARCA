'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const switchTo = theme === 'dark' ? 'claro' : 'oscuro';

  return (
    <button
      type="button"
      aria-label={`Cambiar a modo ${switchTo}`}
      aria-pressed={theme === 'light'}
      title={`Cambiar a modo ${switchTo}`}
      onClick={toggleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {theme === 'dark' ? (
        <Sun aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Moon aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

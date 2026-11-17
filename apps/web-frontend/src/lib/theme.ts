export type AppTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'arca.theme';

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readThemePreference(storage: ThemeStorage): AppTheme {
  return storage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function writeThemePreference(storage: ThemeStorage, theme: AppTheme): void {
  storage.setItem(THEME_STORAGE_KEY, theme);
}

export function toggleTheme(theme: AppTheme): AppTheme {
  return theme === 'dark' ? 'light' : 'dark';
}

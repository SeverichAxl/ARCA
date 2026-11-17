import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readThemePreference,
  THEME_STORAGE_KEY,
  toggleTheme,
  writeThemePreference,
} from '../src/lib/theme';

test('el modo oscuro es el predeterminado y se guarda la preferencia del usuario', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  assert.equal(readThemePreference(storage), 'dark');
  writeThemePreference(storage, toggleTheme(readThemePreference(storage)));
  assert.equal(values.get(THEME_STORAGE_KEY), 'light');
  assert.equal(readThemePreference(storage), 'light');
  assert.equal(toggleTheme('light'), 'dark');
});

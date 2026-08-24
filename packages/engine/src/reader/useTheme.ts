import { useCallback, useEffect, useState } from 'react';
import {
  getTheme,
  migrateLegacySettings,
  setTheme as persistTheme,
  type Theme,
} from '../store/platformSettings';

export type { Theme };

/** @deprecated Use `getTheme()` from the platform settings module. */
export function getStoredTheme(): Theme {
  return getTheme();
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Light → Dark → System theme, persisted locally and applied to <html>. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    migrateLegacySettings();
    return getTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  const cycle = useCallback(() => {
    setThemeState((current) =>
      current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light',
    );
  }, []);

  return { theme, setTheme: setThemeState, cycle };
}

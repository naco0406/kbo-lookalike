import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './use-local-storage';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = '643-theme';

const getSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/**
 * Theme hook — persists to localStorage, applies .dark class on <html>,
 * and uses View Transitions API for smooth switching when available.
 */
export const useTheme = () => {
  const [theme, setThemeRaw] = useLocalStorage<Theme>(STORAGE_KEY, getSystemTheme());

  // Apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Update theme-color meta
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#1c2b3a' : '#f5f2ec');
    }
  }, [theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      // Use View Transitions API if available
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          setThemeRaw(next);
        });
      } else {
        setThemeRaw(next);
      }
    },
    [setThemeRaw],
  );

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggle } as const;
};

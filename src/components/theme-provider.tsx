
// Simplified implementation inspired by next-themes
'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  attribute = 'class',
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme | null;
      if (storedTheme) {
        return storedTheme;
      }
    } catch (e) {
      // Ignore
    }
    return defaultTheme;
  });

  const applyTheme = useCallback((themeToApply: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (themeToApply === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(themeToApply);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  const handleSetTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (e) {
      // Ignore
    }
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

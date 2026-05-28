import { useState, useEffect } from 'react';

const THEME_KEY = 'komiknesia-theme';

export function getStoredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

export function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useTheme = () => {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return { theme, toggleTheme };
};

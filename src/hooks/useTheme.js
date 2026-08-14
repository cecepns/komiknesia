import { useState, useEffect } from 'react';

const THEME_KEY = 'komiknesia-theme';

export function getStoredTheme() {
  return 'dark';
}

export function applyTheme() {
  document.documentElement.classList.add('dark');
}

export const useTheme = () => {
  useEffect(() => {
    localStorage.setItem(THEME_KEY, 'dark');
    applyTheme();
  }, []);

  const toggleTheme = () => {};

  return { theme: 'dark', toggleTheme };
};

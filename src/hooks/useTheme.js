import { useState, useEffect } from 'react';

export const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('komiknesia-theme');
    // Default to 'dark' if nothing is saved
    return saved || 'dark';
  });

  useEffect(() => {
    // Only save dark mode to localStorage, don't save light mode
    if (theme === 'dark') {
      localStorage.setItem('komiknesia-theme', theme);
      document.documentElement.classList.add('dark');
    } else {
      // Remove from localStorage when switching to light mode
      localStorage.removeItem('komiknesia-theme');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
};
export const COLORS = {
  primary: '#DC2626', // Red-600
  primaryHover: '#B91C1C',
  primaryDark: '#991B1B',
  primaryGlow: 'rgba(220, 38, 38, 0.25)',

  background: '#000000', // Pure pitch black #000000
  surface: '#111827', // Card surface
  surfaceElevated: '#1A2234', // Elevated card / drawer / sheet
  surfaceBorder: '#1F293D', // Border
  surfaceBorderLight: '#2D3748',

  text: '#F9FAFB', // Primary text
  textSecondary: '#9CA3AF', // Muted text
  textMuted: '#6B7280', // Inactive text
  textDisabled: '#4B5563',

  // Type badges
  manga: '#3B82F6', // Blue (JP)
  manhwa: '#10B981', // Green (KR)
  manhua: '#F59E0B', // Orange/Amber (CN)
  comic: '#8B5CF6', // Purple

  // Status colors
  ongoing: '#10B981',
  completed: '#6366F1',
  hiatus: '#F59E0B',

  // Accent & utilities
  star: '#FBBF24',
  vip: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  info: '#0EA5E9',
  overlay: 'rgba(0, 0, 0, 0.75)',
  transparent: 'transparent',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  glow: {
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
};

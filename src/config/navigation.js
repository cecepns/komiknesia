import { HomeIcon, Flame, BookMarked, Tags, UserCircle } from 'lucide-react';

/** Navigasi utama mobile bottom bar */
export const mainNavigationItems = [
  { id: 'home', label: 'Home', icon: HomeIcon, path: '/' },
  { id: 'populer', label: 'Populer', icon: Flame, path: '/populer' },
  { id: 'library', label: 'Library', icon: BookMarked, path: '/library' },
  { id: 'genre', label: 'Genre', icon: Tags, path: '/content' },
  { id: 'account', label: 'Akun', icon: UserCircle, path: '/akun', comingSoon: false },
];

export function resolveActiveNavId(pathname) {
  if (pathname === '/populer') return 'populer';
  if (pathname === '/library') return 'library';
  if (pathname === '/content') return 'genre';
  if (pathname === '/akun') return 'account';
  if (pathname === '/' || pathname.startsWith('/komik/') || pathname.startsWith('/view/')) return 'home';
  return 'home';
}

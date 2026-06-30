import { HomeIcon, CalendarDays, FolderIcon, Tags, UserCircle } from 'lucide-react';

/** Navigasi utama mobile bottom bar */
export const mainNavigationItems = [
  { id: 'home', label: 'Home', icon: HomeIcon, path: '/' },
  { id: 'jadwal', label: 'Jadwal', icon: CalendarDays, path: '/jadwal' },
  { id: 'library', label: 'Library', icon: FolderIcon, path: '/library' },
  { id: 'genre', label: 'Genre', icon: Tags, path: '/content' },
  { id: 'account', label: 'Akun', icon: UserCircle, path: '/akun', comingSoon: false },
];

export function resolveActiveNavId(pathname, items = mainNavigationItems) {
  const exact = items.find((item) => item.path === pathname);
  if (exact) return exact.id;
  if (pathname.startsWith('/komik/') || pathname.startsWith('/view/')) return 'home';
  return 'home';
}

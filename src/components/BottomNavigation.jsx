import { useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon, List, UserCircle, FolderIcon, Trophy } from 'lucide-react';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { id: 'home', label: 'Home', icon: HomeIcon, path: '/' },
    { id: 'library', label: 'Library', icon: FolderIcon, path: '/library' },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
    { id: 'list', label: 'Komik', icon: List, path: '/content' },
    { id: 'account', label: 'Akun', icon: UserCircle, path: '/akun', comingSoon: false },
  ];

  const getActiveTab = () => {
    const currentPath = location.pathname;
    const activeItem = navigationItems.find(item => item.path === currentPath);
    return activeItem ? activeItem.id : 'home';
  };

  const activeTab = getActiveTab();

  const handleNavigation = (item) => {
    if (item.comingSoon) return;
    navigate(item.path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 dark:bg-gray-950 py-1.5 z-50">
      <div className="grid grid-cols-5 gap-0.5 px-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-lg transition-all duration-300 min-h-0 ${
                isActive
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              } ${item.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={item.comingSoon}
            >
              <Icon
                className={`shrink-0 ${isActive ? 'h-[18px] w-[18px]' : 'h-4 w-4'}`}
                strokeWidth={isActive ? 2.25 : 2}
              />
              <span
                className={`text-[10px] leading-tight text-center font-medium max-w-full px-0.5 line-clamp-2 ${
                  isActive ? 'font-semibold' : ''
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;

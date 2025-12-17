import { useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon, List, UserCircle, FolderIcon } from 'lucide-react';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { id: 'home', label: 'Home', icon: HomeIcon, path: '/' },
    { id: 'library', label: 'Library', icon: FolderIcon, path: '/library' },
    { id: 'list', label: 'Daftar Komik', icon: List, path: '/daftar-komik' },
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 dark:bg-gray-950 py-2 z-50">
      <div className="grid grid-cols-4 gap-1 px-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item)}
              className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              } ${item.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={item.comingSoon}
            >
              <Icon className={`mb-1 ${isActive ? 'h-7 w-7' : 'h-6 w-6'}`} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
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

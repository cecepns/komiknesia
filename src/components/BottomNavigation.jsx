import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { mainNavigationItems, resolveActiveNavId } from '../config/navigation';

const BOTTOM_OFFSET = 'calc(1rem + env(safe-area-inset-bottom, 0px))';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = resolveActiveNavId(location.pathname, location.search);

  const handleNavigation = (item) => {
    if (item.comingSoon) return;
    navigate(item.path);
  };

  const nav = (
    <nav
      aria-label="Navigasi utama"
      className="md:hidden fixed bottom-0 left-0 right-0 z-[49] w-full bg-black/95 border-t border-white/10 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex w-full items-center justify-around px-1 py-1.5">
        {mainNavigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigation(item)}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 transition-colors duration-200 ${
                isActive
                  ? 'text-red-500 font-bold'
                  : 'text-gray-400 hover:text-gray-200 font-medium'
              } ${item.comingSoon ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={item.comingSoon}
            >
              <Icon
                className={`shrink-0 ${isActive ? 'h-5 w-5 text-red-500' : 'h-4 w-4'}`}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span
                className={`line-clamp-1 w-full text-center text-[10px] leading-tight ${
                  isActive ? 'font-bold' : 'font-medium'
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

  return createPortal(nav, document.body);
};

export default BottomNavigation;

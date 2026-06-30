import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { mainNavigationItems, resolveActiveNavId } from '../config/navigation';
import { useScrollHide } from '../hooks/useScrollHide';

const BOTTOM_OFFSET = 'calc(1rem + env(safe-area-inset-bottom, 0px))';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hidden = useScrollHide();

  const activeTab = resolveActiveNavId(location.pathname);

  const handleNavigation = (item) => {
    if (item.comingSoon) return;
    navigate(item.path);
  };

  const nav = (
    <nav
      aria-label="Navigasi utama"
      className={`md:hidden fixed inset-x-3 z-50 will-change-transform transition-[transform,opacity] duration-300 ease-out ${
        hidden
          ? 'translate-y-[calc(100%+1.5rem)] opacity-0 pointer-events-none'
          : 'translate-y-0 opacity-100'
      }`}
      style={{ bottom: BOTTOM_OFFSET }}
    >
      <div className="overflow-hidden rounded-2xl border border-gray-700/70 bg-gray-900/95 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-md dark:border-gray-800/90 dark:bg-gray-950/95">
        <div className="flex w-full gap-0.5 px-1 py-1.5">
          {mainNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigation(item)}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 transition-colors duration-200 ${
                  isActive
                    ? 'border-sky-500/50 bg-sky-600 text-white shadow-[0_4px_0_0_#c61737] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#c61737]'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                } ${item.comingSoon ? 'cursor-not-allowed opacity-50' : ''}`}
                disabled={item.comingSoon}
              >
                <Icon
                  className={`shrink-0 ${isActive ? 'h-[18px] w-[18px]' : 'h-4 w-4'}`}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                <span
                  className={`line-clamp-1 w-full text-center text-[10px] font-medium leading-tight ${
                    isActive ? 'font-semibold' : ''
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return createPortal(nav, document.body);
};

export default BottomNavigation;

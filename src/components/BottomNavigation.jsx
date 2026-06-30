import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { mainNavigationItems, resolveActiveNavId } from '../config/navigation';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const activeTab = resolveActiveNavId(location.pathname);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 48) {
        setVisible(true);
      } else if (y > lastScrollY + 8) {
        setVisible(false);
      } else if (y < lastScrollY - 8) {
        setVisible(true);
      }
      setLastScrollY(y);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lastScrollY]);

  const handleNavigation = (item) => {
    if (item.comingSoon) return;
    navigate(item.path);
  };

  return (
    <nav
      className={`md:hidden fixed left-0 right-0 z-50 bg-gray-900 dark:bg-gray-950 py-1.5 transition-transform duration-300 ease-out ${
        visible ? 'bottom-0 translate-y-0' : 'bottom-0 translate-y-full'
      }`}
    >
      <div className="overflow-x-auto scrollbar-hide px-1">
        <div className="flex min-w-max gap-1">
          {mainNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item)}
                className={`flex min-w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 transition-all duration-200 ${
                  isActive
                    ? 'border-sky-500/50 bg-sky-600 text-white shadow-[0_4px_0_0_#c61737] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#c61737]'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                } ${item.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={item.comingSoon}
              >
                <Icon
                  className={`shrink-0 ${isActive ? 'h-[18px] w-[18px]' : 'h-4 w-4'}`}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                <span
                  className={`max-w-full px-0.5 text-center text-[10px] font-medium leading-tight line-clamp-2 ${
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
};

export default BottomNavigation;

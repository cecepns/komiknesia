import { useState } from 'react';
import PropTypes from 'prop-types';
import { HomeIcon, List, UserCircle, FolderIcon } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';

const Layout = ({ children }) => {
  const [activeTab, setActiveTab] = useState('home');

  const navigationItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'library', label: 'Library', icon: FolderIcon },
    { id: 'list', label: 'Daftar Komik', icon: List },
    { id: 'account', label: 'Akun', icon: UserCircle, comingSoon: false },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="pt-16 md:pb-8">
        {children}
      </main>

      {/* Footer */}
      <Footer />

      {/* Bottom Navigation - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 dark:bg-gray-950 py-2">
        <div className="grid grid-cols-4 gap-1 px-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => !item.comingSoon && setActiveTab(item.id)}
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
                {/* {item.comingSoon && (
                  <span className="text-[10px] text-gray-500 mt-0.5">Soon</span>
                )} */}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
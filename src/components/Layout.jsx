import PropTypes from 'prop-types';
import Header from './Header';
import Footer from './Footer';
import BottomNavigation from './BottomNavigation';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="pt-16 pb-20 md:pb-8">
        {children}
      </main>

      {/* Footer */}
      <Footer />

      {/* Bottom Navigation - Mobile */}
      <BottomNavigation />
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;
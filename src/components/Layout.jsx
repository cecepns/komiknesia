import PropTypes from "prop-types";
import Header from "./Header";
import Footer from "./Footer";
import BottomNavigation from "./BottomNavigation";
import FloatingFixedAd from "./FloatingFixedAd";
import { useAds } from "../hooks/useAds";

const Layout = ({ children }) => {
  const { ads: floatingTopAds } = useAds("floating-fixed-top");
  const { ads: floatingBottomAds } = useAds("floating-fixed-bottom");

  return (
    <div className="relative min-h-screen bg-black text-gray-100 dark:bg-black dark:text-gray-100">
      {/* Background UI: Hitam polos + hiasan bintang-bintang merah */}
      <div
        className="pointer-events-none fixed inset-0 z-0 hidden dark:block"
        aria-hidden
      >
        {/* Solid black base */}
        <div className="absolute inset-0 bg-black" />

        {/* Subtle ambient red radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(220,38,38,0.12),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(220,38,38,0.1),transparent_45%)]" />

        {/* Red Stars Pattern - Subtle & Sparse */}
        <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="red-stars-pattern" width="380" height="380" patternUnits="userSpaceOnUse">
              {/* Subtle small red star 1 */}
              <path d="M 60,40 Q 60,46 66,46 Q 60,46 60,52 Q 60,46 54,46 Q 60,46 60,40 Z" fill="#ef4444" opacity="0.6" />
              {/* Subtle small red star 2 */}
              <path d="M 280,190 Q 280,195 285,195 Q 280,195 280,200 Q 280,195 275,195 Q 280,195 280,190 Z" fill="#dc2626" opacity="0.5" />
              {/* Subtle small red dot 1 */}
              <circle cx="180" cy="110" r="1.2" fill="#ef4444" opacity="0.6" />
              {/* Subtle small red dot 2 */}
              <circle cx="320" cy="310" r="1" fill="#f87171" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#red-stars-pattern)" />
        </svg>
      </div>

      <div className="relative z-[1] flex min-h-screen flex-col">
        <Header />

        <main className="flex-1 pt-[7.75rem] pb-24 md:pb-8 lg:pt-16">{children}</main>

        <Footer />

        <BottomNavigation />
      </div>

      <FloatingFixedAd position="top" ads={floatingTopAds} />
      <FloatingFixedAd position="bottom" ads={floatingBottomAds} />
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Layout;

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
    <div className="relative min-h-screen bg-white text-gray-900 dark:bg-[#010409] dark:text-gray-100">
      {/* Dark: latar lebih gelap + radial redup + grid biru gelap (bukan di halaman Landing) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 hidden dark:block"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.07),transparent_38%),radial-gradient(circle_at_85%_75%,rgba(248,113,113,0.07),transparent_38%)]" />
        <div className="absolute inset-0 opacity-[0.42] [--card-border:rgba(12,26,48,0.55)] [background-image:linear-gradient(var(--card-border)_1px,transparent_1px),linear-gradient(90deg,var(--card-border)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative z-[1] flex min-h-screen flex-col">
        <Header />

        <main className="flex-1 pt-16 pb-20 md:pb-8">{children}</main>

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

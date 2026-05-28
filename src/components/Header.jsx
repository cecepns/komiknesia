import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Search, X, User, Menu } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import Logo from "../assets/logo.png";
import LazyImage from "./LazyImage";
import { useAuth } from "../contexts/AuthContext";

/** Tombol header — latar sky/cyan (seperti Content); bayangan offset merah */
const contentBtnTrans = "transition-all duration-200";

const contentFilterActive = `rounded-xl border ${contentBtnTrans} border-sky-500/50 bg-sky-600 text-white shadow-[0_7px_0_0_#c61737] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_7px_0_0_#c61737]`;

/** Nav desktop — sama gaya dengan tombol tema (dipakai juga di halaman lain, mis. genre di MangaDetail) */
export const headerNavLinkClass = `inline-flex items-center justify-center ${contentFilterActive} px-4 py-2.5 text-sm font-semibold hover:brightness-[1.03] dark:hover:brightness-110`;

/** Tema, menu mobile, akun */
const headerIconButtonClass = `flex items-center justify-center ${contentFilterActive} p-2.5 text-sm font-semibold hover:brightness-[1.03] dark:hover:brightness-110`;

const mobileNavLinkClass = `w-full text-left ${contentFilterActive} px-4 py-3 text-sm font-semibold hover:brightness-[1.03] dark:hover:brightness-110`;

const mobileAccountButtonClass = `w-full flex items-center justify-center ${contentFilterActive} px-4 py-3 text-sm font-semibold hover:brightness-[1.03] dark:hover:brightness-110`;

const Header = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchDesktopRef = useRef(null);
  const searchMobileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideDesktop =
        searchDesktopRef.current &&
        searchDesktopRef.current.contains(event.target);
      const clickedInsideMobile =
        searchMobileRef.current &&
        searchMobileRef.current.contains(event.target);
      if (!clickedInsideDesktop && !clickedInsideMobile) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchManga = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `https://data.westmanga.me/api/comic?page=1&limit=10&search=${encodeURIComponent(searchQuery)}`,
        );

        if (response.ok) {
          const result = await response.json();
          if (result.status && result.data) {
            setSearchResults(result.data);
            setShowResults(true);
          }
        }
      } catch (error) {
        console.error("Error searching manga:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchManga, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleMangaClick = (manga) => {
    navigate(`/komik/${manga.slug}`);
    setSearchQuery("");
    setShowResults(false);
    setMobileMenuOpen(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  const submitFullSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/content?q=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setShowResults(false);
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      submitFullSearch();
    }
  };

  const handleNavigate = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-white dark:bg-primary-950 shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 gap-4">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <img
              src={Logo}
              alt="Komiknesia"
              className="w-44 h-auto cursor-pointer"
              onClick={() => handleNavigate("/")}
            />
          </div>

          {/* Navigation Links - Hidden on small screens */}
          <nav className="hidden lg:flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleNavigate("/")}
              className={headerNavLinkClass}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/library")}
              className={headerNavLinkClass}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/library?tab=popular&popular=manga")}
              className={headerNavLinkClass}
            >
              Populer
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/content")}
              className={headerNavLinkClass}
            >
              Daftar Komik
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("/contact")}
              className={headerNavLinkClass}
            >
              Kontak
            </button>
            {/* <button
              onClick={() => handleNavigate("/leaderboard")}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
            >
              Leaderboard
            </button> */}
            {/* <button
              onClick={() => handleNavigate("/premium")}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
            >
              Premium
            </button> */}
          </nav>

          <div className="flex items-center space-x-4">
            {/* Search Bar - Desktop */}
            <div
              className="hidden lg:block flex-1 max-w-44 relative"
              ref={searchDesktopRef}
            >
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari manga..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchSubmit}
                  onFocus={() =>
                    searchQuery.length >= 2 && setShowResults(true)
                  }
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showResults && (
                <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
                  {isSearching ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Mencari...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="py-2">
                      {searchResults.map((manga) => (
                        <button
                          key={manga.id}
                          onClick={() => handleMangaClick(manga)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-primary-800 transition-colors text-left"
                        >
                          {/* Cover Image */}
                          <LazyImage
                            src={manga.cover}
                            alt={manga.title}
                            className="w-12 h-16 object-cover rounded flex-shrink-0"
                            wrapperClassName="w-12 h-16 flex-shrink-0"
                          />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-1">
                              {manga.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                              {manga.author ||
                                manga.alternative_name ||
                                "Unknown"}
                            </p>
                            {manga.genres && manga.genres.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {manga.genres.slice(0, 2).map((genre) => (
                                  <span
                                    key={genre.id}
                                    className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded"
                                  >
                                    {genre.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Tidak ada hasil ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Theme Toggle + Account */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                className={headerIconButtonClass}
                aria-label={theme === "light" ? "Mode gelap" : "Mode terang"}
              >
                {theme === "light" ? (
                  <Moon className="h-5 w-5" aria-hidden />
                ) : (
                  <Sun className="h-5 w-5" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("/akun")}
                className={`hidden sm:flex ${headerIconButtonClass}`}
                aria-label={isAuthenticated ? "Akun Saya" : "Masuk / Daftar"}
              >
                <User className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className={`lg:hidden ${headerIconButtonClass}`}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" aria-hidden />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-gray-200 dark:border-gray-800 pt-3">
            <div className="mb-3 relative" ref={searchMobileRef}>
              <div className="flex gap-2 items-stretch">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Cari manga..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchSubmit}
                    onFocus={() =>
                      searchQuery.length >= 2 && setShowResults(true)
                    }
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={submitFullSearch}
                  disabled={!searchQuery.trim()}
                  className="flex-shrink-0 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium transition-colors"
                >
                  Cari
                </button>
              </div>

              {showResults && (
                <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
                  {isSearching ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Mencari...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="py-2">
                      {searchResults.map((manga) => (
                        <button
                          key={manga.id}
                          onClick={() => handleMangaClick(manga)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-primary-800 transition-colors text-left"
                        >
                          <LazyImage
                            src={manga.cover}
                            alt={manga.title}
                            className="w-12 h-16 object-cover rounded flex-shrink-0"
                            wrapperClassName="w-12 h-16 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-1">
                              {manga.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                              {manga.author ||
                                manga.alternative_name ||
                                "Unknown"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Tidak ada hasil ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>
            <nav className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleNavigate("/")}
                className={mobileNavLinkClass}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("/library")}
                className={mobileNavLinkClass}
              >
                Library
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("/library?tab=popular&popular=manga")}
                className={mobileNavLinkClass}
              >
                Populer
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("/content")}
                className={mobileNavLinkClass}
              >
                Daftar Komik
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("/contact")}
                className={mobileNavLinkClass}
              >
                Kontak
              </button>
              {/* <button
                onClick={() => handleNavigate("/leaderboard")}
                className="w-full text-left px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-800"
              >
                Leaderboard
              </button> */}
              {/* <button
                onClick={() => handleNavigate("/premium")}
                className="w-full text-left px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-800"
              >
                Premium
              </button> */}
              <button
                type="button"
                onClick={() => handleNavigate("/akun")}
                className={mobileAccountButtonClass}
              >
                {isAuthenticated ? "Akun Saya" : "Masuk / Daftar"}
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Search, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import Logo from '../assets/logo.png';
import LazyImage from './LazyImage';

const Header = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          `https://data.westmanga.me/api/comic?page=1&limit=10&search=${encodeURIComponent(searchQuery)}`
        );
        
        if (response.ok) {
          const result = await response.json();
          if (result.status && result.data) {
            setSearchResults(result.data);
            setShowResults(true);
          }
        }
      } catch (error) {
        console.error('Error searching manga:', error);
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
    setSearchQuery('');
    setShowResults(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
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
              className="w-32 md:w-44 h-auto cursor-pointer" 
              onClick={() => navigate('/')}
            />
          </div>

          {/* Navigation Links - Hidden on small screens */}
          <nav className="hidden lg:flex items-center space-x-6">
            <button
              onClick={() => navigate('/')}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => navigate('/library')}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
            >
              Library
            </button>
            <button
              onClick={() => navigate('/daftar-komik')}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
            >
              Daftar Komik
            </button>
          </nav>

          {/* Search Bar */}
          <div className="flex-1 max-w-md relative" ref={searchRef}>
            <div className="relative">
              <input
                type="text"
                placeholder="Cari manga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
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
                            {manga.author || manga.alternative_name || 'Unknown'}
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

          {/* Theme Toggle */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-primary-700 hover:bg-gray-200 dark:hover:bg-primary-600 transition-colors"
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;




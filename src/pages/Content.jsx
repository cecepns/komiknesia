import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import LazyImage from '../components/LazyImage';
import Header from '../components/Header';
import AdBanner from '../components/AdBanner';
import { useAds } from '../hooks/useAds';
import { getImageUrl } from '../utils/api';
import { API_BASE_URL } from '../utils/api';


const countryFlags = {
  'JP': '🇯🇵',
  'KR': '🇰🇷',
  'CN': '🇨🇳',
  'US': '🇺🇸',
  'ID': '🇮🇩'
};

const statusOptions = ['All', 'Ongoing', 'Completed', 'Hiatus'];
const typeOptions = [
  { label: 'All', value: 'All', country: null },
  { label: 'Manga', value: 'Manga', country: 'JP' },
  { label: 'Manhua', value: 'Manhua', country: 'CN' },
  { label: 'Manhwa', value: 'Manhwa', country: 'KR' }
];
const orderOptions = ['Az', 'Za', 'Update', 'Added', 'Popular'];

const Content = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  // Ads
  const { ads: comicTopAds } = useAds('comic-top', 2);
  
  const [mangaList, setMangaList] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genresLoading, setGenresLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter states
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState('Update');
  
  // Mobile dropdown states
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  
  // Refs for click outside detection
  const genreDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const orderDropdownRef = useRef(null);

  // Load genres from API
  useEffect(() => {
    const fetchGenres = async () => {
      setGenresLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/contents/genres`);
        const data = await response.json();
        if (data.status && data.data) {
          setGenres(data.data);
        }
      } catch (error) {
        console.error('Error fetching genres:', error);
      } finally {
        setGenresLoading(false);
      }
    };
    fetchGenres();
  }, []);

  const fetchManga = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Add search query if exists
      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      } else {
        // Only add project filter when no search query
        params.append('project', 'false');
      }
      
      // Common parameters
      params.append('page', currentPage);
      params.append('per_page', '40');

      // Add genre filters (can be combined with search)
      selectedGenres.forEach(genreId => {
        params.append('genre[]', genreId);
      });

      // Add status filter (can be combined with search)
      if (selectedStatus !== 'All') {
        params.append('status', selectedStatus);
      }

      // Add type/country filter (can be combined with search)
      const typeOption = typeOptions.find(t => t.value === selectedType);
      if (typeOption && typeOption.country) {
        params.append('country', typeOption.country);
        params.append('type', 'Comic');
      }

      // Add order filter (can be combined with search)
      if (selectedOrder !== 'Update') {
        params.append('orderBy', selectedOrder);
      }

      const response = await fetch(`${API_BASE_URL}/contents?${params.toString()}`);
      const data = await response.json();
      
      if (data.status && data.data) {
        setMangaList(data.data);
        if (data.paginator) {
          setTotalPages(data.paginator.last_page);
        }
      }
    } catch (error) {
      console.error('Error fetching manga:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedGenres, selectedStatus, selectedType, selectedOrder, searchQuery]);

  // Reset page to 1 when search query or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedGenres, selectedStatus, selectedType, selectedOrder]);

  // Load manga based on filters
  useEffect(() => {
    fetchManga();
  }, [fetchManga]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target)) {
        setShowGenreDropdown(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
        setShowTypeDropdown(false);
      }
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(event.target)) {
        setShowOrderDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleGenre = (genreId) => {
    setSelectedGenres(prev => 
      prev.includes(genreId) 
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSelectedGenres([]);
    setSelectedStatus('All');
    setSelectedType('All');
    setSelectedOrder('Update');
    setCurrentPage(1);
    // Clear search query
    if (searchQuery) {
      setSearchParams({});
    }
  };

  const clearSearch = () => {
    setSearchParams({});
    setCurrentPage(1);
  };

  const getTimeAgo = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    const hours = Math.floor(diff / 3600);
    const days = Math.floor(diff / (3600 * 24));
    
    if (hours < 24) {
      return `${hours} jam`;
    } else {
      return `${days} hari`;
    }
  };

  const renderPagination = () => {
    const pages = [];
    // Show fewer page numbers on mobile
    const maxVisible = window.innerWidth < 768 ? 3 : 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // Previous button
    pages.push(
      <button
        key="prev"
        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        className={`px-2 md:px-3 py-2 rounded-lg text-sm md:text-base ${
          currentPage === 1
            ? 'bg-gray-200 dark:bg-primary-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600'
        }`}
      >
        <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
      </button>
    );

    // First page (only show if not in visible range)
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => setCurrentPage(1)}
          className="px-3 md:px-4 py-2 rounded-lg text-sm md:text-base bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600"
        >
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(<span key="dots1" className="px-1 md:px-2 text-gray-500 dark:text-gray-400">...</span>);
      }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base ${
            currentPage === i
              ? 'bg-blue-500 text-white'
              : 'bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600'
          }`}
        >
          {i}
        </button>
      );
    }

    // Last page (only show if not in visible range)
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="dots2" className="px-1 md:px-2 text-gray-500 dark:text-gray-400">...</span>);
      }
      pages.push(
        <button
          key={totalPages}
          onClick={() => setCurrentPage(totalPages)}
          className="px-3 md:px-4 py-2 rounded-lg text-sm md:text-base bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600"
        >
          {totalPages}
        </button>
      );
    }

    // Next button
    pages.push(
      <button
        key="next"
        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        className={`px-2 md:px-3 py-2 rounded-lg text-sm md:text-base ${
          currentPage === totalPages
            ? 'bg-gray-200 dark:bg-primary-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600'
        }`}
      >
        <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
      </button>
    );

    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-primary-950">
      {/* Main Navigation Header */}
      <Header />
      
      {/* Ads Section - Top */}
      <div className="container mx-auto px-4 pt-28 pb-2">
        <AdBanner ads={comicTopAds} layout="grid" columns={2} className="gap-4" />
      </div>
      
      {/* Page Header */}
      <div className="bg-white dark:bg-primary-900 shadow-md sticky top-20 z-40">
        <div className="container mx-auto px-4 py-6 md:py-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {searchQuery ? <>Hasil Pencarian: {'"'}{searchQuery}{'"'}</> : 'Daftar Komik'}
              </h1>
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="mt-2 flex items-center space-x-1 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <X className="h-4 w-4" />
                  <span>Hapus pencarian</span>
                </button>
              )}
            </div>
            <button
              onClick={clearAllFilters}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-300"
            >
              <X className="h-5 w-5" />
              <span className="hidden md:inline">Clear All</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8 pt-24">
        {/* Mobile Filter Dropdowns */}
        <div className="lg:hidden mb-6 grid grid-cols-2 gap-3">
          {/* Genre Dropdown */}
          <div ref={genreDropdownRef} className="relative">
            <button
              onClick={() => setShowGenreDropdown(!showGenreDropdown)}
              className="w-full px-4 py-3 bg-white dark:bg-primary-900 rounded-lg shadow-md flex items-center justify-between text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-primary-800 transition-colors"
            >
              <span className="text-sm font-medium">
                Genre {selectedGenres.length > 0 && `(${selectedGenres.length})`}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showGenreDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showGenreDropdown && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-primary-900 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-gray-200 dark:border-primary-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pilih Genre</span>
                    {selectedGenres.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedGenres([]);
                          setCurrentPage(1);
                        }}
                        className="text-xs text-blue-500 hover:text-blue-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-2">
                  {genresLoading ? (
                    <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                      Loading...
                    </div>
                  ) : (
                    genres.map(genre => (
                      <label
                        key={genre.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-primary-800 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGenres.includes(genre.id)}
                          onChange={() => toggleGenre(genre.id)}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {genre.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status Dropdown */}
          <div ref={statusDropdownRef} className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="w-full px-4 py-3 bg-white dark:bg-primary-900 rounded-lg shadow-md flex items-center justify-between text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-primary-800 transition-colors"
            >
              <span className="text-sm font-medium">Status</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showStatusDropdown && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-primary-900 rounded-lg shadow-xl">
                <div className="p-2">
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        setSelectedStatus(status);
                        setCurrentPage(1);
                        setShowStatusDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 rounded text-sm ${
                        selectedStatus === status
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-800'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Type Dropdown */}
          <div ref={typeDropdownRef} className="relative">
            <button
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="w-full px-4 py-3 bg-white dark:bg-primary-900 rounded-lg shadow-md flex items-center justify-between text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-primary-800 transition-colors"
            >
              <span className="text-sm font-medium">Type</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTypeDropdown && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-primary-900 rounded-lg shadow-xl">
                <div className="p-2">
                  {typeOptions.map(type => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setSelectedType(type.value);
                        setCurrentPage(1);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 rounded text-sm ${
                        selectedType === type.value
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-800'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div ref={orderDropdownRef} className="relative">
            <button
              onClick={() => setShowOrderDropdown(!showOrderDropdown)}
              className="w-full px-4 py-3 bg-white dark:bg-primary-900 rounded-lg shadow-md flex items-center justify-between text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-primary-800 transition-colors"
            >
              <span className="text-sm font-medium">Sort By</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showOrderDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showOrderDropdown && (
              <div className="absolute z-50 w-full mt-2 bg-white dark:bg-primary-900 rounded-lg shadow-xl">
                <div className="p-2">
                  {orderOptions.map(order => (
                    <button
                      key={order}
                      onClick={() => {
                        setSelectedOrder(order);
                        setCurrentPage(1);
                        setShowOrderDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 rounded text-sm ${
                        selectedOrder === order
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-800'
                      }`}
                    >
                      {order}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar - Desktop Only */}
          <div className="hidden lg:block lg:w-80">
            <div className="bg-white dark:bg-primary-900 rounded-lg shadow-md p-6 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Filter</h3>
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  Clear All
                </button>
              </div>

              {/* Status Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Status</h4>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        setSelectedStatus(status);
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedStatus === status
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-primary-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-primary-700'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Type</h4>
                <div className="flex flex-wrap gap-2">
                  {typeOptions.map(type => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setSelectedType(type.value);
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedType === type.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-primary-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-primary-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Order By</h4>
                <div className="flex flex-wrap gap-2">
                  {orderOptions.map(order => (
                    <button
                      key={order}
                      onClick={() => {
                        setSelectedOrder(order);
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedOrder === order
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-primary-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-primary-700'
                      }`}
                    >
                      {order}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genres Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Genres</h4>
                {genresLoading ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    Loading genres...
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {genres.map(genre => (
                      <label
                        key={genre.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-primary-800 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGenres.includes(genre.id)}
                          onChange={() => toggleGenre(genre.id)}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {genre.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Active Filters */}
            {(searchQuery || selectedGenres.length > 0 || selectedStatus !== 'All' || selectedType !== 'All' || selectedOrder !== 'Update') && (
              <div className="mb-6 bg-white dark:bg-primary-900 rounded-lg shadow-md p-4">
                <div className="flex flex-wrap gap-2">
                  {searchQuery && (
                    <span className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                      <span>Pencarian: {'"'}{searchQuery}{'"'}</span>
                      <button
                        onClick={clearSearch}
                        className="hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                  {selectedGenres.map(genreId => {
                    const genre = genres.find(g => g.id === genreId);
                    return genre ? (
                      <span
                        key={genreId}
                        className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                      >
                        <span>{genre.name}</span>
                        <button
                          onClick={() => toggleGenre(genreId)}
                          className="hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ) : null;
                  })}
                  {selectedStatus !== 'All' && (
                    <span className="inline-flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm">
                      <span>Status: {selectedStatus}</span>
                      <button
                        onClick={() => setSelectedStatus('All')}
                        className="hover:text-green-900 dark:hover:text-green-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                  {selectedType !== 'All' && (
                    <span className="inline-flex items-center space-x-2 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                      <span>Type: {selectedType}</span>
                      <button
                        onClick={() => setSelectedType('All')}
                        className="hover:text-purple-900 dark:hover:text-purple-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                  {selectedOrder !== 'Update' && (
                    <span className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full text-sm">
                      <span>Order: {selectedOrder}</span>
                      <button
                        onClick={() => setSelectedOrder('Update')}
                        className="hover:text-orange-900 dark:hover:text-orange-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading manga...</p>
              </div>
            ) : mangaList.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-primary-900 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">
                  No manga found with the selected filters
                </p>
              </div>
            ) : (
              <>
                {/* Manga Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                  {mangaList.map((manga) => (
                    <div
                      key={manga.id}
                      onClick={() => navigate(`/komik/${manga.slug}`)}
                      className="bg-white dark:bg-primary-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
                    >
                      {/* Cover Image */}
                      <div className="relative aspect-[3/4] overflow-hidden">
                        <LazyImage
                          src={getImageUrl(manga.cover)}
                          alt={manga.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          wrapperClassName="w-full h-full"
                        />
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        
                        {/* Country Flag */}
                        <div className="absolute top-2 right-2 text-2xl bg-white/90 dark:bg-primary-900/90 rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                          {countryFlags[manga.country_id] || '🌍'}
                        </div>
                        
                        {/* Color Badge */}
                        {manga.color && (
                          <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
                            </svg>
                            <span>COLOR</span>
                          </div>
                        )}
                        
                        {/* Hot Badge */}
                        {manga.hot && (
                          <div className="absolute bottom-2 left-2 bg-red-500/90 backdrop-blur-sm rounded-full px-2 py-1">
                            <span className="text-white text-xs font-bold">HOT</span>
                          </div>
                        )}
                      </div>

                      {/* Info Section */}
                      <div className="p-3">
                        {/* Title */}
                        <h3 className="font-bold text-sm line-clamp-2 mb-2 text-gray-900 dark:text-gray-100">
                          {manga.title}
                        </h3>
                        
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span className="font-medium">
                            Chapter {manga.lastChapters?.[0]?.number || 'N/A'}
                          </span>
                          {manga.lastChapters?.[0]?.created_at?.time && (
                            <span className="text-gray-500 dark:text-gray-500">
                              {getTimeAgo(manga.lastChapters[0].created_at.time)}
                            </span>
                          )}
                        </div>
                        {/* Rating */}
                        {manga.rating > 0 && (
                          <div className="flex items-center space-x-1">
                            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                            </svg>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {manga.rating}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex justify-center items-center space-x-2 pb-20 md:pb-8">
                  {renderPagination()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Content;

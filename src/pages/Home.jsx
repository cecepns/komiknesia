import { useState, useEffect } from 'react';
import { Flame, Star, Clock } from 'lucide-react';
import MangaCard from '../components/MangaCard';
import SearchBar from '../components/SearchBar';
import UpdateSection from '../components/UpdateSection';
import PopularSection from '../components/PopularSection';
import { useManga } from '../hooks/useManga';
import AOS from 'aos';
import 'aos/dist/aos.css';

const Home = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const { manga, loading, error, totalPages } = useManga(currentPage, searchTerm, selectedCategory);

  useEffect(() => {
    AOS.init({
      duration: 600,
      once: true,
      easing: 'ease-out-cubic',
    });
  }, []);

  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleVoteUpdate = (mangaId) => {
    // Refresh manga list or update vote count locally
    console.log('Vote updated for manga:', mangaId);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`px-4 py-2 rounded-lg ${
            currentPage === i
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          } border border-gray-300 dark:border-gray-600`}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex justify-center items-center space-x-2 mt-8">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        {pages}
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-4">
      {/* Hero Section */}
      <div className="text-center mb-12" data-aos="fade-up">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Selamat Datang di{' '}
          <span className="text-primary-600 dark:text-primary-400">Komiknesia</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Platform baca manga online terlengkap dengan koleksi terbaru dan terpopuler. 
          Nikmati pengalaman membaca yang nyaman di perangkat apapun.
        </p>
      </div>

      {/* Featured Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12" data-aos="fade-up" data-aos-delay="100">
        <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-lg p-6 text-white">
          <div className="flex items-center">
            <Flame className="h-8 w-8 mr-3" />
            <div>
              <h3 className="text-2xl font-bold">{manga.length}</h3>
              <p className="text-red-100">Manga Populer</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg p-6 text-white">
          <div className="flex items-center">
            <Star className="h-8 w-8 mr-3" />
            <div>
              <h3 className="text-2xl font-bold">4.8</h3>
              <p className="text-yellow-100">Rating Tertinggi</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg p-6 text-white">
          <div className="flex items-center">
            <Clock className="h-8 w-8 mr-3" />
            <div>
              <h3 className="text-2xl font-bold">24/7</h3>
              <p className="text-blue-100">Update Harian</p>
            </div>
          </div>
        </div>
      </div>

      {/* Update Section */}
      <div data-aos="fade-up" data-aos-delay="200">
        <UpdateSection />
      </div>

      {/* Popular Section */}
      <div data-aos="fade-up" data-aos-delay="300">
        <PopularSection />
      </div>

      {/* Search Bar */}
      {/* <div data-aos="fade-up" data-aos-delay="400">
        <SearchBar onSearch={handleSearch} onCategoryChange={handleCategoryChange} />
      </div> */}

      {/* Manga Grid */}
      {/* {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="bg-gray-200 dark:bg-gray-900 animate-pulse rounded-lg h-96"></div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">Error: {error}</p>
        </div>
      ) : manga.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Tidak ada manga ditemukan.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" data-aos="fade-up" data-aos-delay="500">
            {manga.map((item, index) => (
              <div key={item.id} data-aos="fade-up" data-aos-delay={500 + index * 50}>
                <MangaCard manga={item} onVoteUpdate={handleVoteUpdate} />
              </div>
            ))}
          </div>
          {renderPagination()}
        </>
      )} */}


    </div>
  );
};

export default Home;
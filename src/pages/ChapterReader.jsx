import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Home, 
  ChevronLeft, 
  ChevronRight,
  List,
  X,
  ChevronDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import LazyImage from '../components/LazyImage';
import { saveToHistory } from '../utils/historyManager';

const ChapterReader = () => {
  const { chapterSlug } = useParams();
  const navigate = useNavigate();
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showChapterList, setShowChapterList] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [mangaSlug, setMangaSlug] = useState(null);
  const topRef = useRef(null);

  // Fetch chapter content (includes all data we need)
  useEffect(() => {
    const fetchChapterData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`https://data.westmanga.me/api/v/${chapterSlug}`);
        
        if (!response.ok) {
          throw new Error('Chapter tidak ditemukan');
        }
        
        const result = await response.json();
        
        if (result.status && result.data) {
          setChapterData(result.data);
          
          // Extract manga slug from API response (assuming it exists in content.slug or derive from data)
          const extractedMangaSlug = result.data.content?.slug || result.data.content?.id;
          setMangaSlug(extractedMangaSlug);
          
          // Set current chapter index from chapters list
          if (result.data.chapters && result.data.chapters.length > 0) {
            const index = result.data.chapters.findIndex(ch => ch.slug === chapterSlug);
            setCurrentChapterIndex(index);
            
            // Save to reading history
            const currentChapter = result.data.chapters[index];
            if (currentChapter && result.data.content) {
              saveToHistory({
                mangaSlug: extractedMangaSlug,
                mangaTitle: result.data.content.title,
                chapterSlug: chapterSlug,
                chapterNumber: currentChapter.number,
                cover: result.data.content.cover
              });
            }
          }
        } else {
          throw new Error('Data chapter tidak valid');
        }
      } catch (err) {
        console.error('Error fetching chapter:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (chapterSlug) {
      fetchChapterData();
      // Scroll to top when chapter changes
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [chapterSlug]);

  const allChapters = chapterData?.chapters || [];
  const mangaData = chapterData?.content || null;

  const handlePrevChapter = () => {
    if (currentChapterIndex < allChapters.length - 1) {
      const prevChapter = allChapters[currentChapterIndex + 1];
      navigate(`/view/${prevChapter.slug}`);
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex > 0) {
      const nextChapter = allChapters[currentChapterIndex - 1];
      navigate(`/view/${nextChapter.slug}`);
    }
  };

  const handleChapterSelect = (chapter) => {
    navigate(`/view/${chapter.slug}`);
    setShowChapterList(false);
  };

  const hasPrevChapter = currentChapterIndex < allChapters.length - 1;
  const hasNextChapter = currentChapterIndex > 0;

  // Handle scroll detection for showing scroll buttons
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollButtons(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll functions - scroll incrementally for better reading experience
  const scrollUp = () => {
    const scrollAmount = 600; // Scroll 600px at a time
    const currentPosition = window.pageYOffset || document.documentElement.scrollTop;
    window.scrollTo({ 
      top: Math.max(0, currentPosition - scrollAmount), 
      behavior: 'smooth' 
    });
  };

  const scrollDown = () => {
    const scrollAmount = 600; // Scroll 600px at a time
    const currentPosition = window.pageYOffset || document.documentElement.scrollTop;
    window.scrollTo({ 
      top: currentPosition + scrollAmount, 
      behavior: 'smooth' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
          <p className="text-gray-400">Loading chapter...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate(mangaSlug ? `/komik/${mangaSlug}` : '/')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {mangaSlug ? 'Kembali ke Detail Manga' : 'Kembali ke Beranda'}
          </button>
        </div>
      </div>
    );
  }

  if (!chapterData) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Chapter tidak ditemukan</p>
        </div>
      </div>
    );
  }

  const currentChapter = allChapters[currentChapterIndex];

  return (
    <div ref={topRef} className="min-h-screen bg-primary-950 text-gray-100">
      {/* Fixed Header */}
      <header className="bg-primary-950 shadow-lg fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-2.5 sm:py-3">
            {/* Left Section */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
              <button
                onClick={() => navigate(mangaSlug ? `/komik/${mangaSlug}` : '/')}
                className="p-1.5 sm:p-2 rounded-lg bg-primary-800 hover:bg-primary-700 transition-colors"
                title="Kembali ke detail manga"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              
              <button
                onClick={() => navigate('/')}
                className="p-1.5 sm:p-2 rounded-lg bg-primary-800 hover:bg-primary-700 transition-colors"
                title="Ke beranda"
              >
                <Home className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Center Section - Chapter Info */}
            <div className="flex-1 mx-2 sm:mx-4 text-center min-w-0">
              <h1 className="text-xs sm:text-sm md:text-base font-semibold line-clamp-1">
                {mangaData?.title || 'Loading...'}
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-400">
                Chapter {currentChapter?.number || chapterData?.number}
              </p>
            </div>

            {/* Right Section */}
            <button
              onClick={() => setShowChapterList(!showChapterList)}
              className="p-1.5 sm:p-2 rounded-lg bg-primary-800 hover:bg-primary-700 transition-colors flex-shrink-0"
              title="Daftar chapter"
            >
              <List className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Chapter List Modal */}
      {showChapterList && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-primary-950 rounded-lg max-w-2xl w-full max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-3 sm:p-4 border-b border-primary-800">
              <h2 className="text-lg sm:text-xl font-bold">Daftar Chapter</h2>
              <button
                onClick={() => setShowChapterList(false)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-primary-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chapter List */}
            <div className="overflow-y-auto flex-1 p-3 sm:p-4">
              <div className="space-y-2">
                {allChapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    onClick={() => handleChapterSelect(chapter)}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg transition-colors ${
                      chapter.slug === chapterSlug
                        ? 'bg-primary-600 text-white'
                        : 'bg-primary-800 hover:bg-primary-700 text-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm sm:text-base">Chapter {chapter.number}</span>
                      {index === 0 && (
                        <span className="text-[10px] sm:text-xs bg-red-500 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                          NEW
                        </span>
                      )}
                    </div>
                    {chapter.title && chapter.title !== `Chapter ${chapter.number}` && (
                      <p className="text-xs sm:text-sm text-gray-400 mt-1 line-clamp-1">{chapter.title}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-16 sm:pt-20 pb-20 sm:pb-24">
        <div className="max-w-4xl mx-auto">
          {/* Chapter Title */}
          <div className="px-3 sm:px-4 py-4 sm:py-6 text-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2 line-clamp-2">
              {mangaData?.title || chapterData?.title}
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-400">
              Chapter {currentChapter?.number || chapterData?.number}
            </p>
          </div>

          {/* Chapter Images */}
          <div className="space-y-0">
            {chapterData?.images && chapterData.images.length > 0 ? (
              chapterData.images.map((image, index) => (
                <div key={index} className="w-full leading-[0]">
                  <LazyImage
                    src={image}
                    alt={`Page ${index + 1}`}
                    className="w-full h-auto block"
                    wrapperClassName="w-full block"
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-12 px-4 text-gray-400 text-sm sm:text-base">
                Tidak ada gambar tersedia untuk chapter ini
              </div>
            )}
          </div>

          {/* Navigation Buttons (Bottom) */}
          <div className="px-3 sm:px-4 py-6 sm:py-8">
            <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
              <button
                onClick={handlePrevChapter}
                disabled={!hasPrevChapter}
                className={`flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                  hasPrevChapter
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'bg-primary-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Prev Chapter</span>
                <span className="sm:hidden">Prev</span>
              </button>

              <button
                onClick={() => setShowChapterList(true)}
                className="flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-sm sm:text-base bg-primary-800 hover:bg-primary-700 text-white transition-colors"
              >
                <List className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                <span className="hidden sm:inline">Chapters</span>
                <span className="sm:hidden">List</span>
              </button>

              <button
                onClick={handleNextChapter}
                disabled={!hasNextChapter}
                className={`flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                  hasNextChapter
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'bg-primary-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span className="hidden sm:inline">Next Chapter</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 sm:ml-2" />
              </button>
            </div>
          </div>

          {/* Comment Section */}
          <div className="px-3 sm:px-4 pb-6 sm:pb-8">
            <div className="bg-primary-900 rounded-lg p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
                <span>Komentar</span>
                <span className="text-xs sm:text-sm font-normal text-gray-400">(Coming Soon)</span>
              </h3>
              <div className="text-center py-8 sm:py-12 border-2 border-dashed border-primary-700 rounded-lg">
                <p className="text-sm sm:text-base text-gray-400 mb-2">
                  Fitur komentar akan segera hadir
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  Anda akan dapat berbagi pendapat tentang chapter ini
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-primary-950 border-t border-primary-800 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handlePrevChapter}
              disabled={!hasPrevChapter}
              className={`flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors min-w-0 ${
                hasPrevChapter
                  ? 'bg-primary-800 hover:bg-primary-700 text-white'
                  : 'bg-primary-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden xs:inline">Prev</span>
            </button>

            <button
              onClick={() => setShowChapterList(true)}
              className="flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base bg-primary-600 hover:bg-primary-700 text-white transition-colors flex-shrink-0"
            >
              <span className="mr-1 sm:mr-2">Ch. {currentChapter?.number || chapterData?.number}</span>
              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>

            <button
              onClick={handleNextChapter}
              disabled={!hasNextChapter}
              className={`flex items-center justify-center px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors min-w-0 ${
                hasNextChapter
                  ? 'bg-primary-800 hover:bg-primary-700 text-white'
                  : 'bg-primary-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              <span className="hidden xs:inline">Next</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Scroll Buttons (Desktop Only) */}
      <div className={`hidden md:flex fixed right-6 bottom-20 flex-col gap-2 z-50 transition-all duration-300 ${
        showScrollButtons ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        <button
          onClick={scrollUp}
          className="p-3 bg-primary-800 hover:bg-primary-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 group"
          title="Scroll ke atas"
        >
          <ArrowUp className="h-5 w-5 group-hover:animate-bounce" />
        </button>
        <button
          onClick={scrollDown}
          className="p-3 bg-primary-800 hover:bg-primary-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 group"
          title="Scroll ke bawah"
        >
          <ArrowDown className="h-5 w-5 group-hover:animate-bounce" />
        </button>
      </div>
    </div>
  );
};

export default ChapterReader;







import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, 
  Home, 
  Play, 
  Star, 
  Eye, 
  Bookmark,
  Search,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import LazyImage from '../components/LazyImage';
import BottomNavigation from '../components/BottomNavigation';
import { API_BASE_URL, apiClient, getImageUrl } from '../utils/api';
import AdBanner from '../components/AdBanner';
import { useAds } from '../hooks/useAds';
import { useAuth } from '../contexts/AuthContext';
import CommentSection from '../components/CommentSection';


// Import vote assets
import senangImg from '../assets/votes/senang.png';
import biasaAjaImg from '../assets/votes/biasa-aja.png';
import kecewaImg from '../assets/votes/kecewa.png';
import marahImg from '../assets/votes/marah.png';
import sedihImg from '../assets/votes/sedih.png';

const MangaDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [manga, setManga] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkChecking, setBookmarkChecking] = useState(false);
  const [activeTab, setActiveTab] = useState('chapters');
  const [searchChapter, setSearchChapter] = useState('');
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' (from chapter 1) or 'desc' (from last chapter)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Vote states
  const [voteData, setVoteData] = useState({
    senang: 0,
    biasaAja: 0,
    kecewa: 0,
    marah: 0,
    sedih: 0
  });
  const [selectedVote, setSelectedVote] = useState(null);
  const [voteLoading, setVoteLoading] = useState(false);

  const { ads: chapterTopAds } = useAds('chapter-top', 4);
  const { ads: listChapterAds } = useAds('list-chapter', 2);
  const { ads: topUpvoteAds } = useAds('top-upvote', 2);

  useEffect(() => {
    const fetchMangaDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${API_BASE_URL}/comic/${slug}`);
        
        if (!response.ok) {
          throw new Error('Manga tidak ditemukan');
        }
        
        const result = await response.json();
        
        if (result.status && result.data) {
          setManga(result.data);
          generateChapters(result.data);
        } else {
          throw new Error('Data manga tidak valid');
        }
      } catch (err) {
        console.error('Error fetching manga:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchMangaDetail();
    }
  }, [slug]);

  // Fetch vote data (use apiClient so token is sent when logged in -> vote per user)
  useEffect(() => {
    const fetchVoteData = async () => {
      if (!slug) return;
      try {
        const result = await apiClient.getVotes(slug);
        if (result.status && result.data) {
          setVoteData(result.data);
          if (result.userVote) setSelectedVote(result.userVote);
          else setSelectedVote(null);
        }
      } catch (err) {
        console.error('Error fetching vote data:', err);
      }
    };
    fetchVoteData();
  }, [slug]);

  // Check bookmark when logged in
  useEffect(() => {
    if (!isAuthenticated || !slug) {
      setBookmarked(false);
      return;
    }
    setBookmarkChecking(true);
    apiClient.checkBookmark(slug).then((res) => {
      setBookmarked(res.status && res.bookmarked);
    }).catch(() => setBookmarked(false)).finally(() => setBookmarkChecking(false));
  }, [isAuthenticated, slug]);

  const generateChapters = (mangaData) => {
    // Create chapters from API response
    const chapterList = [];
    
    if (mangaData.chapters && mangaData.chapters.length > 0) {
      // Use chapters from API
      mangaData.chapters.forEach((ch, index) => {
        // Handle timestamp conversion
        // Prefer updated_at if available (more accurate for "last updated" display)
        // Otherwise use created_at
        // API returns Unix timestamp in seconds, convert to milliseconds
        let uploadedAt = Date.now();
        
        // Try updated_at first, then created_at
        const timeSource = ch.updated_at || ch.created_at;
        
        if (timeSource?.time) {
          const timestamp = timeSource.time;
          // API always returns Unix timestamp in seconds (not milliseconds)
          // Convert to milliseconds by multiplying by 1000
          // Threshold: if timestamp < 1e12, it's in seconds; if >= 1e12, it's already in milliseconds
          const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
          
          // Validate the timestamp
          const dateFromTimestamp = new Date(timestampMs);
          
          // Check if timestamp is valid (not NaN and reasonable date)
          if (!isNaN(dateFromTimestamp.getTime())) {
            // If timestamp is in the future (more than 1 hour), it might be wrong
            // But we'll still use it and let formatTimeAgo handle it
            uploadedAt = timestampMs;
          } else {
            // Invalid timestamp, try formatted date
            if (timeSource?.formatted) {
              try {
                const parsedDate = new Date(timeSource.formatted);
                if (!isNaN(parsedDate.getTime())) {
                  uploadedAt = parsedDate.getTime();
                }
              } catch {
                console.warn('Failed to parse formatted date:', timeSource.formatted);
              }
            }
          }
        } else if (timeSource?.formatted) {
          // Fallback: try to parse formatted date
          try {
            const parsedDate = new Date(timeSource.formatted);
            if (!isNaN(parsedDate.getTime())) {
              uploadedAt = parsedDate.getTime();
            }
          } catch {
            console.warn('Failed to parse formatted date:', timeSource.formatted);
          }
        }
        
        chapterList.push({
          id: ch.id,
          content_id: ch.content_id,
          number: ch.number,
          title: `Chapter ${ch.number}`,
          thumbnail: mangaData.cover,
          uploadedAt: uploadedAt,
          isNew: index === 0,
          slug: ch.slug
        });
      });
    }
    
    setChapters(chapterList);
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp || isNaN(timestamp)) {
      return 'Tidak diketahui';
    }
    
    const now = Date.now();
    let diff = now - timestamp;
    
    // Debug logging for timestamp issues
    if (Math.abs(diff) > 365 * 24 * 60 * 60 * 1000 || diff < 0) {
      console.warn('Timestamp calculation issue:', {
        timestamp,
        timestampDate: new Date(timestamp).toISOString(),
        now,
        nowDate: new Date(now).toISOString(),
        diff,
        diffHours: diff / (1000 * 60 * 60),
        diffDays: diff / (1000 * 60 * 60 * 24)
      });
    }
    
    // If diff is negative, timestamp is in the future (likely wrong)
    // This can happen if timestamp was not properly converted from seconds to milliseconds
    // Or if the timestamp itself is incorrect
    if (diff < 0) {
      // If timestamp is way in the future (more than 1 year), it's likely wrong
      // In this case, we can't calculate relative time accurately
      if (Math.abs(diff) > 365 * 24 * 60 * 60 * 1000) {
        return 'Waktu tidak valid';
      }
      
      // For timestamps in the near future (less than 1 year), show as "soon" or use absolute value
      // But this shouldn't happen normally
      diff = Math.abs(diff);
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (days > 0) return `${days} hari lalu`;
    if (hours > 0) return `${hours} jam lalu`;
    if (minutes > 0) return `${minutes} menit lalu`;
    return 'Baru saja';
  };

  const filteredChapters = chapters
    .filter(chapter =>
      searchChapter === '' || 
      chapter.title.toLowerCase().includes(searchChapter.toLowerCase()) ||
      chapter.number.toString().includes(searchChapter)
    )
    .sort((a, b) => {
      // Sort by chapter number
      const numA = parseFloat(a.number);
      const numB = parseFloat(b.number);
      
      if (sortOrder === 'asc') {
        return numA - numB; // Ascending: chapter 1 first
      } else {
        return numB - numA; // Descending: last chapter first
      }
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredChapters.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedChapters = filteredChapters.slice(startIndex, endIndex);

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchChapter, sortOrder]);

  const voteOptions = [
    { id: 'senang', label: 'Senang', image: senangImg, count: voteData.senang },
    { id: 'biasaAja', label: 'Biasa Aja', image: biasaAjaImg, count: voteData.biasaAja },
    { id: 'kecewa', label: 'Kecewa', image: kecewaImg, count: voteData.kecewa },
    { id: 'marah', label: 'Marah', image: marahImg, count: voteData.marah },
    { id: 'sedih', label: 'Sedih', image: sedihImg, count: voteData.sedih }
  ];

  const totalVotes = Object.values(voteData).reduce((sum, val) => sum + val, 0);

  const handleVote = async (voteId) => {
    if (!slug) return;
    setVoteLoading(true);
    try {
      const result = await apiClient.submitVote(slug, voteId);
      if (result.status) {
        if (result.action === 'removed') {
          setVoteData(prev => ({ ...prev, [voteId]: Math.max(0, prev[voteId] - 1) }));
          setSelectedVote(null);
        } else if (result.action === 'updated') {
          setVoteData(prev => ({
            ...prev,
            [result.previous_vote]: Math.max(0, prev[result.previous_vote] - 1),
            [result.new_vote]: prev[result.new_vote] + 1,
          }));
          setSelectedVote(voteId);
        } else {
          setVoteData(prev => ({ ...prev, [voteId]: prev[voteId] + 1 }));
          setSelectedVote(voteId);
        }
        const refresh = await apiClient.getVotes(slug);
        if (refresh.status && refresh.data) {
          setVoteData(refresh.data);
          setSelectedVote(refresh.userVote || null);
        }
      }
    } catch (err) {
      console.error('Error submitting vote:', err);
    } finally {
      setVoteLoading(false);
    }
  };

  const toggleBookmark = async () => {
    if (!isAuthenticated) {
      navigate('/akun');
      return;
    }
    if (bookmarkChecking) return;
    setBookmarkChecking(true);
    try {
      // Always use slug as bookmark identifier so backend can resolve/sync manga correctly
      const identifier = slug;

      if (bookmarked) {
        await apiClient.removeBookmark(identifier);
        setBookmarked(false);
      } else {
        await apiClient.addBookmark(identifier);
        setBookmarked(true);
      }
    } catch (err) {
      console.error('Bookmark error:', err);
    } finally {
      setBookmarkChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Loading...</p>
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
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Manga tidak ditemukan</p>
        </div>
      </div>
    );
  }

  const countryFlags = {
    'JP': '🇯🇵',
    'KR': '🇰🇷',
    'CN': '🇨🇳',
    'US': '🇺🇸',
    'ID': '🇮🇩'
  };

  // SEO data
  const siteUrl = 'https://komiknesia.net';
  const pageUrl = `${siteUrl}/komik/${slug}`;
  const coverImage = manga ? getImageUrl(manga.cover) : `${siteUrl}/logo.png`;
  const seriesType = manga?.content_type || 'Komik';
  const description = `Baca ${seriesType} ${manga?.title || 'komik'} bahasa Indonesia di KomikNesia. Sinopsis lengkap, daftar chapter, dan update terbaru tersedia di sini.`;
  const genresList = manga?.genres?.map(g => g.name).join(', ') || '';
  const author = manga?.author || '';
  const rating = manga?.rating || 'N/A';
  const totalChapters = chapters.length;

  return (
    <div className="min-h-screen bg-primary-950 text-gray-100">
      <Helmet>
        <title>{manga?.title ? `${manga.title} Bahasa Indonesia - KomikNesia` : 'KomikNesia'}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={pageUrl} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="book" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={manga?.title ? `${manga.title} – ${seriesType} Bahasa Indonesia | KomikNesia` : 'KomikNesia'} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={coverImage} />
        <meta property="og:site_name" content="KomikNesia" />
        <meta property="og:locale" content="id_ID" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={pageUrl} />
        <meta name="twitter:title" content={manga?.title ? `${manga.title} – ${seriesType} Bahasa Indonesia | KomikNesia` : 'KomikNesia'} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={coverImage} />
        
        {/* Additional meta tags */}
        <meta name="keywords" content={`${manga?.title || ''}, ${genresList}, baca komik, manga online, komiknesia`} />
        {author && <meta name="author" content={author} />}
        
        {/* Structured Data - Book/Comic */}
        {manga && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Book",
              "name": manga.title,
              "alternateName": manga.alternative_name || undefined,
              "author": author ? {
                "@type": "Person",
                "name": author
              } : undefined,
              "image": coverImage,
              "description": description,
              "url": pageUrl,
              "publisher": {
                "@type": "Organization",
                "name": "KomikNesia",
                "url": siteUrl
              },
              "inLanguage": "id-ID",
              "bookFormat": manga.content_type || "Comic",
              "numberOfPages": totalChapters,
              "aggregateRating": rating !== 'N/A' ? {
                "@type": "AggregateRating",
                "ratingValue": rating,
                "bestRating": "10",
                "worstRating": "1"
              } : undefined,
              "genre": genresList ? genresList.split(', ') : undefined
            })}
          </script>
        )}
      </Helmet>
      
      {/* Header */}
      <header className="bg-primary-950 shadow-md fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <button
              onClick={() => navigate('/content')}
              className="p-2 rounded-lg bg-primary-800 hover:bg-primary-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg bg-primary-800 hover:bg-primary-700 transition-colors"
            >
              <Home className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Chapter Top Ads - 4 ads at top */}
          {chapterTopAds.length > 0 && (
            <div className="mb-6">
              <AdBanner ads={chapterTopAds} layout="grid" columns={2} />
            </div>
          )}

          {/* Hero Section with Cover */}
          <div className="relative h-80 md:h-96 rounded-xl overflow-hidden mb-8">
            <div 
              className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
              style={{ backgroundImage: `url(${getImageUrl(manga.cover)})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950 via-primary-950/50 to-transparent" />
            
            <div className="relative h-full flex items-end p-6">
              <div className="flex items-end space-x-6 w-full">
                {/* Cover Image */}
                <div className="flex-shrink-0">
                  <LazyImage
                    src={getImageUrl(manga.cover)}
                    alt={manga.title}
                    className="w-32 md:w-48 rounded-lg shadow-2xl"
                    wrapperClassName="w-32 md:w-48"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 pb-2">
                  <h1 className="text-md md:text-3xl md:text-4xl font-bold text-white mb-2 line-clamp-3">
                    {manga.title}
                  </h1>
                  {manga.alternative_name && (
                    <p className="text-xs md:text-sm text-gray-300 mb-4 line-clamp-2">{manga.alternative_name}</p>
                  )}
                  
                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-4 text-white mb-4">
                    <div className="flex items-center">
                      <Star className="h-5 w-5 text-yellow-400 mr-1 fill-yellow-400" />
                      <span className="font-semibold">{manga.rating || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <Eye className="h-5 w-5 text-green-400 mr-1" />
                      <span>{manga.total_views?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex items-center">
                      <Bookmark className="h-5 w-5 text-purple-400 mr-1" />
                      <span>{manga.bookmark_count?.toLocaleString() || '0'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        if (chapters.length > 0) {
                          navigate(`/view/${chapters[0].slug}`);
                        }
                      }}
                      className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={chapters.length === 0}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Baca
                    </button>
                    {isAuthenticated && (
                      <button
                        type="button"
                        onClick={toggleBookmark}
                        disabled={bookmarkChecking}
                        className={`p-3 rounded-lg transition-all ${bookmarked ? 'bg-purple-600 text-white' : 'bg-primary-800 text-gray-300 hover:bg-primary-700'}`}
                        title={bookmarked ? 'Hapus bookmark' : 'Simpan bookmark'}
                      >
                        <Bookmark className={`h-5 w-5 ${bookmarked ? 'fill-current' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <div className="bg-primary-900 rounded-lg p-6 mb-6">
            <div 
              className="text-gray-300 leading-relaxed prose prose-sm max-w-none prose-invert"
              dangerouslySetInnerHTML={{ __html: manga.sinopsis || 'Tidak ada sinopsis tersedia.' }}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-3 mb-8">
            {/* Genres */}
            {manga.genres && manga.genres.length > 0 && (
              <>
                {manga.genres.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => navigate(`/content?genre=${encodeURIComponent(genre.name)}`)}
                    className="px-4 py-2 bg-purple-900/30 rounded-lg hover:bg-purple-900/50 transition-colors cursor-pointer"
                  >
                    <span className="text-sm font-medium text-purple-300">
                      {genre.name}
                    </span>
                  </button>
                ))}
              </>
            )}
            
            {/* Author */}
            {manga.author && (
              <div className="px-4 py-2 bg-primary-800 rounded-lg">
                <span className="text-sm font-medium text-gray-300">
                  <span className="text-gray-400">Author:</span> {manga.author}
                </span>
              </div>
            )}
            
            {/* Content Type */}
            <div className="px-4 py-2 bg-primary-800 rounded-lg">
              <span className="text-sm font-medium text-gray-300">
                <span className="text-gray-400">Type:</span> {manga.content_type || 'Comic'}
              </span>
            </div>
            
            {/* Status */}
            <div className="px-4 py-2 bg-primary-800 rounded-lg">
              <span className="text-sm font-medium text-gray-300">
                <span className="text-gray-400">Status:</span> {manga.status === 'ongoing' ? 'Ongoing' : 'Completed'}
              </span>
            </div>
            
            {/* Release Year */}
            {manga.release && (
              <div className="px-4 py-2 bg-primary-800 rounded-lg">
                <span className="text-sm font-medium text-gray-300">
                  <span className="text-gray-400">Release:</span> {manga.release}
                </span>
              </div>
            )}
            
            {/* Project Badge */}
            {manga.is_project && (
              <div className="px-4 py-2 bg-blue-900/30 rounded-lg">
                <span className="text-sm font-medium text-blue-300">
                  Project
                </span>
              </div>
            )}
          </div>

          {/* List Chapter Ads - 2 ads above tabs */}
          {listChapterAds.length > 0 && (
            <div className="mb-6">
              <AdBanner ads={listChapterAds} layout="grid" columns={2} />
            </div>
          )}

          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-primary-900 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('chapters')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                activeTab === 'chapters'
                  ? 'bg-primary-800 text-gray-100 shadow'
                  : 'text-gray-400 hover:text-gray-100'
              }`}
            >
              Chapters
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                activeTab === 'info'
                  ? 'bg-primary-800 text-gray-100 shadow'
                  : 'text-gray-400 hover:text-gray-100'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTab('novel')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                activeTab === 'novel'
                  ? 'bg-primary-800 text-gray-100 shadow'
                  : 'text-gray-400 hover:text-gray-100'
              }`}
            >
              Novel
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'chapters' && (
            <div>
              {/* Search Bar and Sort Toggle */}
              <div className="mb-6 flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Cari Chapter, Contoh: 69 atau 76"
                    value={searchChapter}
                    onChange={(e) => setSearchChapter(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border border-primary-800 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-primary-900 text-gray-100 placeholder:text-gray-500"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
                
                {/* Sort Toggle */}
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-2 px-4 py-3 bg-primary-900 rounded-lg hover:bg-primary-800 transition-all duration-300 border border-primary-800"
                  title={sortOrder === 'asc' ? 'Urut dari Chapter 1' : 'Urut dari Chapter Terakhir'}
                >
                  {sortOrder === 'asc' ? (
                    <>
                      <ArrowUp className="h-5 w-5 text-green-400" />
                      <span className="text-sm text-gray-300 hidden sm:inline">Ch 1</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-5 w-5 text-blue-400" />
                      <span className="text-sm text-gray-300 hidden sm:inline">Ch Terakhir</span>
                    </>
                  )}
                </button>
              </div>

              {/* List View */}
              <div className="space-y-3">
                {paginatedChapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className="bg-primary-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer flex items-center justify-between p-4"
                    onClick={() => navigate(`/view/${chapter.slug}`)}
                  >
                    {/* Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-base md:text-lg mb-1 text-gray-100">
                        {chapter.title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {formatTimeAgo(chapter.uploadedAt)}
                      </p>
                    </div>

                    {/* Badges and Icon */}
                    <div className="flex items-center gap-3">
                      {chapter.isNew && (
                        <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                          UP
                        </div>
                      )}
                      <Play className="h-6 w-6 text-gray-400 group-hover:text-purple-400 transition-colors duration-300" />
                    </div>
                  </div>
                ))}
              </div>

              {filteredChapters.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-400">
                    Tidak ada chapter yang ditemukan
                  </p>
                </div>
              )}

              {/* Pagination */}
              {filteredChapters.length > 0 && (
                <div className="mt-8 flex flex-col items-center gap-4">
                  {/* Page Info */}
                  <div className="text-sm text-gray-400">
                    Menampilkan {startIndex + 1}-{Math.min(endIndex, filteredChapters.length)} dari {filteredChapters.length} chapter
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center gap-2">
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-primary-900 hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-primary-800"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        const showPage = 
                          page === 1 || 
                          page === totalPages || 
                          (page >= currentPage - 1 && page <= currentPage + 1);
                        
                        // Show ellipsis
                        const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                        const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                        if (showEllipsisBefore || showEllipsisAfter) {
                          return (
                            <span key={page} className="px-2 text-gray-500">
                              ...
                            </span>
                          );
                        }

                        if (!showPage) return null;

                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[40px] px-3 py-2 rounded-lg transition-all duration-300 font-medium ${
                              currentPage === page
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-primary-900 text-gray-300 hover:bg-primary-800 border border-primary-800'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg bg-primary-900 hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-primary-800"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'info' && (
            <div className="bg-primary-900 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Informasi Manga</h3>
              <div className="space-y-3">
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Title:</span>
                  <span>{manga.title}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Alt Title:</span>
                  <span>{manga.alternative_name || '-'}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Type:</span>
                  <span>{manga.content_type || 'Comic'}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Author:</span>
                  <span>{manga.author || '-'}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Genres:</span>
                  <span>
                    {manga.genres && manga.genres.length > 0
                      ? manga.genres.map(g => g.name).join(', ')
                      : '-'}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Status:</span>
                  <span className={manga.status === 'ongoing' ? 'text-green-400' : 'text-blue-400'}>
                    {manga.status === 'ongoing' ? 'Ongoing' : 'Completed'}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Country:</span>
                  <span>{countryFlags[manga.country_id] || ''} {manga.country_id || '-'}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Release:</span>
                  <span>{manga.release || '-'}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Total Chapters:</span>
                  <span>{chapters.length}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Total Views:</span>
                  <span>{manga.total_views?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Bookmarks:</span>
                  <span>{manga.bookmark_count?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Rating:</span>
                  <span>{manga.rating || 'N/A'}</span>
                </div>
                {manga.created_at && (
                  <div className="flex">
                    <span className="font-semibold w-32 text-gray-400">Created:</span>
                    <span>{manga.created_at.formatted}</span>
                  </div>
                )}
                {manga.updated_at && (
                  <div className="flex">
                    <span className="font-semibold w-32 text-gray-400">Last Update:</span>
                    <span>{manga.updated_at.formatted}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'novel' && (
            <div className="bg-primary-900 rounded-lg p-6">
              <div className="text-center py-12">
                <p className="text-gray-400">
                  Novel belum tersedia untuk manga ini
                </p>
              </div>
            </div>
          )}

          {/* Top Upvote Ads - 2 ads above vote section */}
          {topUpvoteAds.length > 0 && (
            <div className="mt-8 mb-6">
              <AdBanner ads={topUpvoteAds} layout="grid" columns={2} />
            </div>
          )}

          {/* Vote Section */}
          <div className="mt-8 bg-primary-900 rounded-lg p-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl md:text-3xl font-bold mb-2">Vote Manga</h3>
              <p className="text-xl md:text-2xl text-gray-300 font-semibold">
                {totalVotes} <span className="text-base text-gray-400 font-normal">Reactions</span>
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 md:gap-8">
              {voteOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleVote(option.id)}
                  disabled={voteLoading}
                  className={`flex flex-col items-center group transition-all duration-300 hover:scale-110 ${
                    selectedVote === option.id ? 'scale-110' : ''
                  } ${voteLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {/* Vote Count Badge */}
                  <div className={`mb-2 px-4 py-1 rounded-full font-bold text-sm transition-all duration-300 ${
                    selectedVote === option.id 
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400' 
                      : 'bg-primary-800 text-gray-300 group-hover:bg-purple-600 group-hover:text-white'
                  }`}>
                    {option.count}
                  </div>

                  {/* Character Avatar */}
                  <div className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden transition-all duration-300 ${
                    selectedVote === option.id 
                      ? 'ring-4 ring-purple-500 shadow-lg shadow-purple-500/50' 
                      : 'ring-2 ring-primary-700 group-hover:ring-4 group-hover:ring-purple-400'
                  }`}>
                    <img 
                      src={option.image} 
                      alt={option.label}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Label */}
                  <p className={`mt-2 text-sm md:text-base font-medium transition-colors duration-300 ${
                    selectedVote === option.id 
                      ? 'text-purple-400' 
                      : 'text-gray-300 group-hover:text-purple-400'
                  }`}>
                    {option.label}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              Klik untuk memberikan vote atau mengubah pilihan
            </div>
          </div>

          {/* Comment Section */}
          {manga && (
            <div className="mt-8">
              <CommentSection
                mangaId={manga.slug || manga.id}
                scope="manga" // Hanya komentar level manga (bukan per chapter/external_slug)
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation - Mobile */}
      <BottomNavigation />
    </div>
  );
};

export default MangaDetail;












import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Home, 
  Play, 
  Star, 
  Eye, 
  Bookmark,
  Search,
  ChevronDown
} from 'lucide-react';
import LazyImage from '../components/LazyImage';

const MangaDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [manga, setManga] = useState(null);
  const [activeTab, setActiveTab] = useState('chapters');
  const [searchChapter, setSearchChapter] = useState('');
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMangaDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`https://data.westmanga.me/api/comic/${slug}`);
        
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

  const generateChapters = (mangaData) => {
    // Create chapters from API response
    const chapterList = [];
    
    if (mangaData.chapters && mangaData.chapters.length > 0) {
      // Use chapters from API
      mangaData.chapters.forEach((ch, index) => {
        chapterList.push({
          id: ch.id,
          content_id: ch.content_id,
          number: ch.number,
          title: `Chapter ${ch.number}`,
          thumbnail: mangaData.cover,
          uploadedAt: ch.created_at?.time ? ch.created_at.time * 1000 : Date.now(),
          isNew: index === 0,
          slug: ch.slug
        });
      });
    }
    
    setChapters(chapterList);
  };

  const formatTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (days > 0) return `${days} hari lalu`;
    if (hours > 0) return `${hours} jam lalu`;
    return 'Baru saja';
  };

  const filteredChapters = chapters.filter(chapter =>
    searchChapter === '' || 
    chapter.title.toLowerCase().includes(searchChapter.toLowerCase()) ||
    chapter.number.toString().includes(searchChapter)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="bg-gray-950 shadow-md fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <Home className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section with Cover */}
          <div className="relative h-80 md:h-96 rounded-xl overflow-hidden mb-8">
            <div 
              className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
              style={{ backgroundImage: `url(${manga.cover})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/50 to-transparent" />
            
            <div className="relative h-full flex items-end p-6">
              <div className="flex items-end space-x-6 w-full">
                {/* Cover Image */}
                <div className="flex-shrink-0">
                  <LazyImage
                    src={manga.cover}
                    alt={manga.title}
                    className="w-32 md:w-48 rounded-lg shadow-2xl"
                    wrapperClassName="w-32 md:w-48"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 pb-2">
                  <h1 className="text-lg md:text-3xl md:text-4xl font-bold text-white mb-2 line-clamp-3">
                    {manga.title}
                  </h1>
                  {manga.alternative_name && (
                    <p className="text-gray-300 mb-4">{manga.alternative_name}</p>
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

                  {/* Read Button */}
                  <button 
                    onClick={() => {
                      if (chapters.length > 0) {
                        navigate(`/manga/${slug}/chapter/${chapters[0].slug}`);
                      }
                    }}
                    className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={chapters.length === 0}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Baca
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <div className="bg-gray-900 rounded-lg p-6 mb-6">
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
                  <div key={genre.id} className="px-4 py-2 bg-purple-900/30 rounded-lg">
                    <span className="text-sm font-medium text-purple-300">
                      {genre.name}
                    </span>
                  </div>
                ))}
              </>
            )}
            
            {/* Author */}
            {manga.author && (
              <div className="px-4 py-2 bg-gray-800 rounded-lg">
                <span className="text-sm font-medium text-gray-300">
                  <span className="text-gray-400">Author:</span> {manga.author}
                </span>
              </div>
            )}
            
            {/* Content Type */}
            <div className="px-4 py-2 bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-300">
                <span className="text-gray-400">Type:</span> {manga.content_type || 'Comic'}
              </span>
            </div>
            
            {/* Status */}
            <div className="px-4 py-2 bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-300">
                <span className="text-gray-400">Status:</span> {manga.status === 'ongoing' ? 'Ongoing' : 'Completed'}
              </span>
            </div>
            
            {/* Release Year */}
            {manga.release && (
              <div className="px-4 py-2 bg-gray-800 rounded-lg">
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

          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-900 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('chapters')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                activeTab === 'chapters'
                  ? 'bg-gray-800 text-gray-100 shadow'
                  : 'text-gray-400 hover:text-gray-100'
              }`}
            >
              Chapters
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                activeTab === 'info'
                  ? 'bg-gray-800 text-gray-100 shadow'
                  : 'text-gray-400 hover:text-gray-100'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setActiveTab('novel')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                activeTab === 'novel'
                  ? 'bg-gray-800 text-gray-100 shadow'
                  : 'text-gray-400 hover:text-gray-100'
              }`}
            >
              Novel
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'chapters' && (
            <div>
              {/* Search Bar */}
              <div className="mb-6 relative">
                <input
                  type="text"
                  placeholder="Cari Chapter, Contoh: 69 atau 76"
                  value={searchChapter}
                  onChange={(e) => setSearchChapter(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-gray-900 text-gray-100 placeholder:text-gray-500"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Chapters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredChapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    className="bg-gray-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
                    onClick={() => navigate(`/manga/${slug}/chapter/${chapter.slug}`)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <LazyImage
                        src={chapter.thumbnail}
                        alt={chapter.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        wrapperClassName="w-full h-full"
                      />
                      {chapter.isNew && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                          UP
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="font-semibold text-sm mb-1 text-gray-100 line-clamp-1">
                        {chapter.title}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {formatTimeAgo(chapter.uploadedAt)}
                      </p>
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
            </div>
          )}

          {activeTab === 'info' && (
            <div className="bg-gray-900 rounded-lg p-6">
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
            <div className="bg-gray-900 rounded-lg p-6">
              <div className="text-center py-12">
                <p className="text-gray-400">
                  Novel belum tersedia untuk manga ini
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MangaDetail;



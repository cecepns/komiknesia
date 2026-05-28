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
  ChevronRight,
  Share2,
  X,
  Sparkles,
  Copy,
  ExternalLink,
  Heart,
  ListChecks,
  Download,
  Loader2,
} from 'lucide-react';
import LazyImage from '../components/LazyImage';
import BottomNavigation from '../components/BottomNavigation';
import { API_BASE_URL, apiClient, getImageUrl } from '../utils/api';
import AdBanner from '../components/AdBanner';
import FloatingFixedAd from '../components/FloatingFixedAd';
import { useAds } from '../hooks/useAds';
import { useAuth } from '../contexts/AuthContext';
import CommentSection from '../components/CommentSection';
import { headerNavLinkClass } from '../components/Header';
import {
  WhatsappShareButton,
  TelegramShareButton,
  TwitterShareButton,
  WhatsappIcon,
  TelegramIcon,
  TwitterIcon,
} from 'react-share';
import { toast } from 'react-toastify';
import discordIcon from '../assets/discord.svg';
import { downloadChapterZip } from '../utils/downloadChapterZip';

import { REACTION_OPTIONS, sumReactionCounts } from '../constants/reactions';

const MangaDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [manga, setManga] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkChecking, setBookmarkChecking] = useState(false);
  const [readlistPickerOpen, setReadlistPickerOpen] = useState(false);
  const [readlistsForPicker, setReadlistsForPicker] = useState([]);
  const [readlistsPickerLoading, setReadlistsPickerLoading] = useState(false);
  const [readlistAddSubmitting, setReadlistAddSubmitting] = useState(null);
  const [activeTab, setActiveTab] = useState('chapters');
  const [searchChapter, setSearchChapter] = useState('');
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' (from chapter 1) or 'desc' (from last chapter)
  const [currentPage, setCurrentPage] = useState(1);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  const [downloadingChapterSlug, setDownloadingChapterSlug] = useState(null);
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

  const { ads: chapterTopAds } = useAds('chapter-top');
  const { ads: listChapterAds } = useAds('list-chapter');
  const { ads: topUpvoteAds } = useAds('top-upvote');
  const { ads: floatingTopAds } = useAds('floating-fixed-top');
  const { ads: floatingBottomAds } = useAds('floating-fixed-bottom');

  const discordInviteUrl = 'https://discord.gg/dgC22PSm9h';
  const donateUrl = 'https://saweria.co/KomikNesia';

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

  useEffect(() => {
    if (!readlistPickerOpen || !isAuthenticated) return undefined;
    let cancelled = false;
    setReadlistsPickerLoading(true);
    apiClient
      .getReadlists()
      .then((res) => {
        if (cancelled) return;
        if (res.status && Array.isArray(res.data)) setReadlistsForPicker(res.data);
        else setReadlistsForPicker([]);
      })
      .catch(() => {
        if (!cancelled) setReadlistsForPicker([]);
      })
      .finally(() => {
        if (!cancelled) setReadlistsPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readlistPickerOpen, isAuthenticated]);

  const openReadlistPicker = () => {
    if (!isAuthenticated) {
      navigate('/akun');
      return;
    }
    setReadlistPickerOpen(true);
  };

  const addMangaToReadlist = async (readlistId) => {
    if (!slug) return;
    setReadlistAddSubmitting(readlistId);
    try {
      const res = await apiClient.addReadlistItems(readlistId, { slugs: [slug] });
      if (res.status) {
        const added = Number(res.added) || 0;
        const title =
          readlistsForPicker.find((r) => Number(r.id) === Number(readlistId))?.title || 'readlist';
        if (added > 0) {
          toast.success(`Komik ditambahkan ke “${title}”.`);
        } else {
          toast.info('Komik ini sudah ada di readlist tersebut.');
        }
        setReadlistPickerOpen(false);
      } else {
        toast.error(res.error || 'Gagal menambahkan ke readlist.');
      }
    } catch (err) {
      console.error('Readlist add error:', err);
      toast.error('Gagal menambahkan ke readlist.');
    } finally {
      setReadlistAddSubmitting(null);
    }
  };

  const generateChapters = (mangaData) => {
    // Create chapters from API response
    const chapterList = [];
    
    if (mangaData.chapters && mangaData.chapters.length > 0) {
      // Use chapters from API
      mangaData.chapters.forEach((ch, index) => {
        // Waktu chapter = saat publish (created_at), bukan saat dibaca/di-update view counter
        let uploadedAt = Date.now();
        const timeSource = ch.created_at;
        
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
          title: ch.title || `Chapter ${ch.number}`,
          thumbnail: mangaData.cover,
          uploadedAt: uploadedAt,
          isNew: index === 0,
          slug: ch.slug,
          views: Number(ch.views) || 0,
          reactionCount: Number(ch.reaction_count) || 0,
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

  const voteOptions = REACTION_OPTIONS.map((opt) => ({
    ...opt,
    count: voteData[opt.id] ?? 0,
  }));

  const totalVotes = sumReactionCounts(voteData);

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
        } else if (result.action === 'unchanged') {
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

  const handleDownloadChapter = async (chapter, event) => {
    event?.stopPropagation?.();
    if (!chapter?.slug || downloadingChapterSlug) return;

    setDownloadingChapterSlug(chapter.slug);
    try {
      await downloadChapterZip({
        slug: chapter.slug,
        mangaTitle: manga?.title,
        chapterNumber: chapter.number,
      });
      toast.success(`Chapter ${chapter.number} berhasil diunduh (ZIP).`);
    } catch (err) {
      console.error('Download chapter error:', err);
      toast.error(err?.message || 'Gagal mengunduh chapter.');
    } finally {
      setDownloadingChapterSlug(null);
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
        setManga((prev) =>
          prev
            ? {
                ...prev,
                bookmark_count: Math.max(0, (Number(prev.bookmark_count) || 0) - 1),
              }
            : prev
        );
      } else {
        await apiClient.addBookmark(identifier);
        setBookmarked(true);
        setManga((prev) =>
          prev
            ? {
                ...prev,
                bookmark_count: (Number(prev.bookmark_count) || 0) + 1,
              }
            : prev
        );
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
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://komiknesia.com';
  const pageUrl = `${siteUrl}/komik/${slug}`;
  const shareOrigin = typeof window !== 'undefined' ? window.location.origin : siteUrl;
  const mangaShareUrl = `${shareOrigin}/komik/${slug}`;
  const shareTitle = `Baca ${manga?.title || 'komik'} bahasa Indonesia di KomikNesia`;

  const copyMangaShareLink = async (context = 'default') => {
    try {
      await navigator.clipboard.writeText(mangaShareUrl);
      if (context === 'tiktok') {
        toast.success('Link disalin. Buka TikTok dan tempel di bio, DM, atau caption.');
      } else {
        toast.success('Tautan berhasil disalin.');
      }
    } catch {
      toast.error('Gagal menyalin. Salin manual: ' + mangaShareUrl);
    }
  };
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

          {/* Hero: mobile = kolom tengah (sample); md+ = layout horizontal seperti sebelumnya */}
          <div className="relative mb-8 overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 md:h-96 md:rounded-xl md:bg-primary-950 md:ring-0">
            <div
              className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl opacity-45 md:opacity-100 md:blur-xl md:scale-110"
              style={{ backgroundImage: `url(${getImageUrl(manga.cover)})` }}
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-black/30 via-primary-950/90 to-primary-950 md:bg-gradient-to-t md:from-primary-950 md:via-primary-950/50 md:to-transparent"
              aria-hidden
            />

            <div className="relative flex flex-col items-center px-4 pb-8 pt-10 text-center md:h-full md:flex-row md:items-end md:justify-start md:gap-6 md:p-6 md:pb-6 md:pt-6 md:text-left">
              <div className="mx-auto w-[11.5rem] shrink-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15 sm:w-48 md:mx-0 md:w-32 md:rounded-lg md:ring-0 lg:w-48">
                <LazyImage
                  src={getImageUrl(manga.cover)}
                  alt={manga.title}
                  className="aspect-[3/4] w-full object-cover"
                  wrapperClassName="block w-full"
                />
              </div>

              <div className="mt-7 flex w-full max-w-md flex-1 flex-col items-center md:mt-0 md:max-w-none md:items-stretch md:pb-2">
                <h1 className="mb-2 text-2xl font-bold leading-tight text-white sm:text-3xl md:text-3xl lg:text-4xl">
                  {manga.title}
                </h1>
                {manga.alternative_name && (
                  <p className="mt-2 max-w-xl text-sm text-gray-300/95 line-clamp-4 sm:text-base md:mb-4 md:line-clamp-2">
                    {manga.alternative_name}
                  </p>
                )}

                {/* Urutan: tombol dulu (mobile), stat dulu (desktop) */}
                <div className="order-1 mt-6 flex w-full flex-col space-y-3 md:order-2 md:mt-0 md:flex-row md:flex-wrap md:gap-3 md:space-y-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (chapters.length > 0) navigate(`/view/${chapters[0].slug}`);
                    }}
                    disabled={chapters.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-red-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:px-6 md:py-3"
                  >
                    <Play className="h-5 w-5 shrink-0" aria-hidden />
                    Baca
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleBookmark()}
                    disabled={bookmarkChecking}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition active:scale-[0.99] md:w-auto md:px-3 md:py-3 ${
                      bookmarked
                        ? 'bg-violet-600 text-white shadow-md hover:bg-violet-500 md:bg-violet-600 md:shadow-md md:hover:bg-violet-500'
                        : 'bg-primary-800/95 text-gray-100 hover:bg-primary-700 md:bg-primary-800 md:text-gray-300 md:hover:bg-primary-700'
                    }`}
                    title={bookmarked ? 'Hapus bookmark' : 'Simpan bookmark'}
                  >
                    <Bookmark className={`h-5 w-5 shrink-0 md:h-5 md:w-5 ${bookmarked ? 'fill-current' : ''}`} aria-hidden />
                    <span className="md:sr-only">{bookmarked ? 'Hapus bookmark' : 'Simpan bookmark'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openReadlistPicker()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-800/95 px-4 py-3.5 text-base font-semibold text-gray-100 transition hover:bg-primary-700 active:scale-[0.99] md:w-auto md:px-3 md:py-3 md:bg-primary-800 md:text-gray-300 md:hover:bg-primary-700"
                    title="Tambah ke readlist"
                  >
                    <ListChecks className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="md:sr-only">Tambah ke readlist</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharePopupOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-800/95 px-4 py-3.5 text-base font-semibold text-gray-100 transition hover:bg-primary-700 active:scale-[0.99] md:hidden"
                  >
                    <Share2 className="h-5 w-5 shrink-0" aria-hidden />
                    Bagikan
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharePopupOpen(true)}
                    className="hidden md:inline-flex md:items-center md:justify-center md:rounded-lg md:bg-primary-800 md:p-3 md:text-gray-300 md:transition-all md:hover:bg-primary-700 md:hover:text-white"
                    title="Bagikan komik ini"
                    aria-label="Bagikan"
                  >
                    <Share2 className="h-5 w-5" aria-hidden />
                  </button>
                </div>

                <div className="order-2 mt-7 flex w-full max-w-md flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-6 text-sm text-gray-100 sm:gap-3 md:order-1 md:mt-0 md:max-w-none md:justify-start md:gap-3 md:border-0 md:pt-0 md:mb-4">
                  {(() => {
                    const r = manga.rating;
                    const n = r != null && r !== '' ? Number(r) : NaN;
                    const ratingLabel = Number.isFinite(n) ? n.toFixed(1) : 'N/A';
                    return (
                  <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-3.5 py-2 tabular-nums shadow-sm md:gap-1 md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none">
                    <Star className="h-5 w-5 shrink-0 text-amber-400 fill-amber-400" aria-hidden />
                    <span className="text-base font-bold tracking-tight text-white md:text-sm md:font-semibold">
                      {ratingLabel}
                    </span>
                    {Number.isFinite(n) && (
                      <span className="text-xs font-medium text-amber-200/90">/ 10</span>
                    )}
                  </div>
                    );
                  })()}
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-2 tabular-nums backdrop-blur-sm">
                    <Eye className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
                    <span className="font-semibold text-white">
                      {(Number(manga.total_views) || 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-xs text-gray-400">tayangan</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-2 tabular-nums backdrop-blur-sm">
                    <Bookmark className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
                    <span className="font-semibold text-white">
                      {(Number(manga.bookmark_count) || 0).toLocaleString('id-ID')}
                    </span>
                    <span className="text-xs text-gray-400">bookmark</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sinopsis: mobile = kartu + judul; desktop = blok sederhana seperti sebelumnya */}
          <div className="mb-6 rounded-2xl border border-white/10 bg-primary-900/90 p-5 shadow-inner sm:p-6 md:rounded-lg md:border-0 md:bg-primary-900 md:p-6 md:shadow-none">
            <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 md:hidden">
              Sinopsis
            </h2>
            <div
              className="prose prose-sm max-w-none leading-relaxed text-gray-300 prose-invert prose-p:my-2 prose-headings:text-gray-200 md:prose-p:my-0"
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
                    type="button"
                    key={genre.id}
                    onClick={() => navigate(`/content?genre=${encodeURIComponent(genre.name)}`)}
                    className={headerNavLinkClass}
                  >
                    {genre.name}
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
              {/* Bagikan komik, Discord, Donasi — di atas daftar chapter */}
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setSharePopupOpen(true)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-slate-700/90 bg-[#111827] p-3.5 text-left shadow-md transition-all hover:border-slate-600 hover:bg-slate-800/95 sm:gap-4 sm:p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-inner sm:h-12 sm:w-12">
                    <Share2 className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white sm:text-base">Bagikan komik</p>
                    <p className="text-xs text-slate-400 sm:text-sm">
                      Salin tautan, WhatsApp, X, TikTok, Telegram
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300 sm:h-5 sm:w-5"
                    aria-hidden
                  />
                </button>

                <a
                  href={discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex w-full items-center gap-3 rounded-2xl border border-slate-700/90 bg-[#111827] p-3.5 text-left shadow-md transition-all hover:border-slate-600 hover:bg-slate-800/95 sm:gap-4 sm:p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5865F2] text-white shadow-inner sm:h-12 sm:w-12">
                    <img src={discordIcon} alt="" className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white sm:text-base">Discord</p>
                    <p className="text-xs text-slate-400 sm:text-sm">Gabung komunitas pembaca</p>
                  </div>
                  <ExternalLink
                    className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-300 sm:h-5 sm:w-5"
                    aria-hidden
                  />
                </a>

                <a
                  href={donateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex w-full items-center gap-3 rounded-2xl border border-slate-700/90 bg-[#111827] p-3.5 text-left shadow-md transition-all hover:border-slate-600 hover:bg-slate-800/95 sm:gap-4 sm:p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-inner sm:h-12 sm:w-12">
                    <Heart className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white sm:text-base">Donasi</p>
                    <p className="text-xs text-slate-400 sm:text-sm">Dukung lewat Saweria</p>
                  </div>
                  <ExternalLink
                    className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-300 sm:h-5 sm:w-5"
                    aria-hidden
                  />
                </a>
              </div>

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
                    className="bg-primary-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer flex items-center justify-between gap-3 p-3 sm:gap-4 sm:p-4"
                    onClick={() => navigate(`/view/${chapter.slug}`)}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                      <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-md bg-primary-800 ring-1 ring-primary-700/80 sm:w-16">
                        <LazyImage
                          src={getImageUrl(chapter.thumbnail || manga?.cover)}
                          alt={chapter.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          wrapperClassName="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-1 text-base font-semibold text-gray-100 md:text-lg">
                          {chapter.title}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {formatTimeAgo(chapter.uploadedAt)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                            <span>{(chapter.views ?? 0).toLocaleString('id-ID')} lihat</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden />
                            <span>{(chapter.reactionCount ?? 0).toLocaleString('id-ID')} reaksi</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Badges and actions */}
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      {chapter.isNew && (
                        <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                          UP
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDownloadChapter(chapter, e)}
                        disabled={downloadingChapterSlug === chapter.slug}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary-800 hover:text-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Unduh gambar chapter (ZIP)"
                        aria-label={`Unduh chapter ${chapter.number} sebagai ZIP`}
                      >
                        {downloadingChapterSlug === chapter.slug ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        ) : (
                          <Download className="h-5 w-5" aria-hidden />
                        )}
                      </button>
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
                  <span className="font-semibold w-32 text-gray-400">Total tayangan:</span>
                  <span>{(Number(manga.total_views) || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Total bookmark:</span>
                  <span>{(Number(manga.bookmark_count) || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex">
                  <span className="font-semibold w-32 text-gray-400">Rating:</span>
                  <span className="tabular-nums">
                    {(() => {
                      const r = manga.rating;
                      const n = r != null && r !== '' ? Number(r) : NaN;
                      return Number.isFinite(n) ? `${n.toFixed(1)} / 10` : 'N/A';
                    })()}
                  </span>
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
              <h3 className="text-2xl md:text-3xl font-bold mb-2">Reaksi manga</h3>
              <p className="text-xl md:text-2xl text-gray-300 font-semibold">
                {totalVotes} <span className="text-base text-gray-400 font-normal">reaksi</span>
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
                  <div
                    className={`mb-2 rounded-full px-3 py-1 text-sm font-bold transition-all duration-300 ${
                      selectedVote === option.id
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                        : 'bg-primary-800 text-gray-300 group-hover:bg-purple-600 group-hover:text-white'
                    }`}
                  >
                    {option.count}
                  </div>

                  <div
                    className={`flex h-20 w-20 select-none items-center justify-center overflow-hidden rounded-full transition-all duration-300 md:h-24 md:w-24 ${
                      selectedVote === option.id
                        ? 'ring-4 ring-purple-500 shadow-lg shadow-purple-500/50'
                        : 'ring-2 ring-primary-700 group-hover:ring-4 group-hover:ring-purple-400'
                    }`}
                  >
                    <img
                      src={option.image}
                      alt={option.label}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <p
                    className={`mt-2 text-sm font-medium transition-colors duration-300 md:text-base ${
                      selectedVote === option.id
                        ? 'text-purple-400'
                        : 'text-gray-300 group-hover:text-purple-400'
                    }`}
                  >
                    {option.label}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 text-center text-xs text-gray-500">
              Klik untuk memberikan reaksi atau mengubah pilihan
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

      {readlistPickerOpen && (
        <div
          className="fixed inset-0 z-[71] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Pilih readlist"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 text-left shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Tambah ke readlist</h3>
              <button
                type="button"
                onClick={() => setReadlistPickerOpen(false)}
                className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Pilih readlist untuk menyimpan komik ini. Kamu bisa mengatur readlist di halaman Library.
            </p>
            {readlistsPickerLoading ? (
              <p className="py-8 text-center text-sm text-slate-400">Memuat readlist…</p>
            ) : readlistsForPicker.length === 0 ? (
              <div className="space-y-4 py-2">
                <p className="text-sm text-slate-300">
                  Belum ada readlist. Buat readlist dulu di Library, lalu kembali ke halaman ini.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setReadlistPickerOpen(false);
                    navigate('/library?tab=readlist');
                  }}
                  className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Buka Library — Readlist
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {readlistsForPicker.map((rl) => (
                  <li key={rl.id}>
                    <button
                      type="button"
                      disabled={readlistAddSubmitting != null}
                      onClick={() => addMangaToReadlist(rl.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="min-w-0 truncate">{rl.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {readlistAddSubmitting === rl.id
                          ? 'Menyimpan…'
                          : `${Number(rl.manga_count) || 0} komik`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {sharePopupOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Bagikan komik"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 text-left shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Bagikan komik ini</h3>
              <button
                type="button"
                onClick={() => setSharePopupOpen(false)}
                className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Tutup popup share"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-400">
              Pilih cara membagikan tautan halaman komik ini ke teman atau medsos kamu.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => copyMangaShareLink('default')}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-600">
                  <Copy className="h-5 w-5" aria-hidden />
                </span>
                <span>Salin tautan</span>
              </button>

              <WhatsappShareButton
                url={mangaShareUrl}
                title={shareTitle}
                separator=" — "
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                resetButtonStyle={false}
                onClick={() => setSharePopupOpen(false)}
              >
                <WhatsappIcon size={40} round />
                <span>WhatsApp</span>
              </WhatsappShareButton>

              <TwitterShareButton
                url={mangaShareUrl}
                title={shareTitle}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                resetButtonStyle={false}
                onClick={() => setSharePopupOpen(false)}
              >
                <TwitterIcon size={40} round />
                <span>X (Twitter)</span>
              </TwitterShareButton>

              <button
                type="button"
                onClick={() => copyMangaShareLink('tiktok')}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-lg font-bold tracking-tight text-white ring-1 ring-white/20"
                  aria-hidden
                >
                  TT
                </span>
                <span className="flex flex-col">
                  <span>TikTok</span>
                  <span className="text-xs font-normal text-slate-400">
                    Salin tautan untuk dibagikan di TikTok
                  </span>
                </span>
              </button>

              <TelegramShareButton
                url={mangaShareUrl}
                title={shareTitle}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                resetButtonStyle={false}
                onClick={() => setSharePopupOpen(false)}
              >
                <TelegramIcon size={40} round />
                <span>Telegram</span>
              </TelegramShareButton>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Mobile */}
      <BottomNavigation />

      <FloatingFixedAd position="top" ads={floatingTopAds} />
      <FloatingFixedAd position="bottom" ads={floatingBottomAds} />
      {/* <LiveChatWidget /> */}
    </div>
  );
};

export default MangaDetail;












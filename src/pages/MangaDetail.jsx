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
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Share2,
  ExternalLink,
  Heart,
  ListChecks,
  Download,
  Loader2,
  Crown,
  Lock,
  BookOpen,
  ThumbsUp,
  PencilLine,
  Copy,
  X,
  CheckCircle,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  WhatsappShareButton,
  TelegramShareButton,
  TwitterShareButton,
  WhatsappIcon,
  TelegramIcon,
  TwitterIcon,
} from 'react-share';
import LazyImage from '../components/LazyImage';
import { API_BASE_URL, apiClient, getImageUrl } from '../utils/api';
import AdBanner from '../components/AdBanner';
import { useAds } from '../hooks/useAds';
import { useAuth } from '../contexts/AuthContext';
import CommentSection from '../components/CommentSection';
import { toast } from 'react-toastify';
import discordIcon from '../assets/discord.svg';
import { downloadChapterPdf } from '../utils/downloadChapterPdf';
import LoginModal from '../components/LoginModal';
import { useChapterAccess } from '../hooks/useChapterAccess';
import { requiresChapterLogin, isLatestChapterInList } from '../utils/chapterAccess';
import BottomNavigation from '../components/BottomNavigation';
import LiveChatWidget from '../components/LiveChatWidget';

import { REACTION_OPTIONS, emptyReactionCounts, sumReactionCounts } from '../constants/reactions';

const MangaDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { loginOpen, openChapter, handleLoginSuccess, closeLogin } = useChapterAccess();
  const [manga, setManga] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkChecking, setBookmarkChecking] = useState(false);
  const [readlistPickerOpen, setReadlistPickerOpen] = useState(false);
  const [readlistsForPicker, setReadlistsForPicker] = useState([]);
  const [readlistsPickerLoading, setReadlistsPickerLoading] = useState(false);
  const [readlistAddSubmitting, setReadlistAddSubmitting] = useState(null);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('chapters'); // 'chapters', 'rekomendasi'
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [recommendedManga, setRecommendedManga] = useState([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);

  const [searchChapter, setSearchChapter] = useState('');
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadingChapterSlug, setDownloadingChapterSlug] = useState(null);
  const [customThumbnails, setCustomThumbnails] = useState({});
  const [readChapterSlugs, setReadChapterSlugs] = useState(new Set());

  const [mangaReactionData, setMangaReactionData] = useState(() => emptyReactionCounts());
  const [selectedMangaReaction, setSelectedMangaReaction] = useState(null);
  const [mangaReactionLoading, setMangaReactionLoading] = useState(false);

  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    setMangaReactionLoading(true);
    apiClient
      .getVotes(slug)
      .then((res) => {
        if (cancelled || !res?.status || !res.data) return;
        setMangaReactionData({ ...emptyReactionCounts(), ...res.data });
        setSelectedMangaReaction(res.userVote ?? res.userReaction ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMangaReactionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleMangaReaction = async (reactionType) => {
    if (!slug) return;
    setMangaReactionLoading(true);
    try {
      const result = await apiClient.submitVote(slug, reactionType);
      if (result?.status) {
        const refresh = await apiClient.getVotes(slug);
        if (refresh?.status && refresh.data) {
          setMangaReactionData({ ...emptyReactionCounts(), ...refresh.data });
          setSelectedMangaReaction(refresh.userVote ?? refresh.userReaction ?? null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMangaReactionLoading(false);
    }
  };

  const itemsPerPage = 10;

  const { ads: chapterTopAds } = useAds('chapter-top');
  const { ads: listChapterAds } = useAds('list-chapter');

  const discordInviteUrl = 'https://discord.gg/dgC22PSm9h';
  const donateUrl = 'https://saweria.co/KomikNesia';

  useEffect(() => {
    try {
      const readSet = new Set();
      
      const kh = JSON.parse(localStorage.getItem('komiknesia_history') || '[]');
      kh.forEach((item) => {
        if (item.chapterSlug) readSet.add(item.chapterSlug);
        if (item.slug) readSet.add(item.slug);
      });

      const mh = JSON.parse(localStorage.getItem('mangaHistory') || '[]');
      mh.forEach((item) => {
        if (item.chapterSlug) readSet.add(item.chapterSlug);
        if (item.slug) readSet.add(item.slug);
      });

      setReadChapterSlugs(readSet);
    } catch {
      /* ignore */
    }
  }, []);

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

  useEffect(() => {
    if (activeTab === 'rekomendasi' && manga) {
      const fetchRecommended = async () => {
        try {
          setRecommendedLoading(true);
          const firstGenre = manga.genres?.[0]?.name;
          const res = await apiClient.getContents({
            per_page: 30,
            genre: firstGenre || undefined,
            orderBy: 'Update',
          });
          if (res.status && Array.isArray(res.data)) {
            const filtered = res.data.filter((item) => item.slug !== slug);
            // Fisher-Yates shuffle to randomize recommendations on each load/toggle
            const shuffled = [...filtered].sort(() => 0.5 - Math.random());
            setRecommendedManga(shuffled.slice(0, 12));
          }
        } catch (err) {
          console.error('Error fetching recommended manga:', err);
        } finally {
          setRecommendedLoading(false);
        }
      };
      fetchRecommended();
    }
  }, [activeTab, manga, slug]);

  useEffect(() => {
    if (!isAuthenticated || !slug) {
      setBookmarked(false);
      return;
    }
    setBookmarkChecking(true);
    apiClient
      .checkBookmark(slug)
      .then((res) => {
        setBookmarked(res.status && res.bookmarked);
      })
      .catch(() => setBookmarked(false))
      .finally(() => setBookmarkChecking(false));
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
    const chapterList = [];
    if (mangaData.chapters && mangaData.chapters.length > 0) {
      mangaData.chapters.forEach((ch, index) => {
        let uploadedAt = Date.now();
        const timeSource = ch.created_at;

        if (timeSource?.time) {
          const timestamp = timeSource.time;
          const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
          const dateFromTimestamp = new Date(timestampMs);
          if (!isNaN(dateFromTimestamp.getTime())) {
            uploadedAt = timestampMs;
          }
        }

        let customThumb = null;
        try {
          customThumb = localStorage.getItem(`komiknesia_custom_ch_thumb_${ch.slug}`);
        } catch {
          /* ignore */
        }

        if (customThumb) {
          setCustomThumbnails((prev) => ({ ...prev, [ch.slug]: customThumb }));
        }

        chapterList.push({
          ...ch,
          id: ch.id,
          content_id: ch.content_id,
          number: ch.number,
          title: ch.title || `Chapter ${ch.number}`,
          thumbnail: customThumb || mangaData.cover,
          uploadedAt: uploadedAt,
          isNew: index === 0,
          slug: ch.slug,
          views: Number(ch.views || ch.view_count) || 0,
          reaction_count: Number(ch.reaction_count || ch.reactionCount || ch.likes || ch.votes) || 0,
        });
      });
    }
    setChapters(chapterList);
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp || isNaN(timestamp)) return 'Tidak diketahui';
    const now = Date.now();
    let diff = now - timestamp;
    if (diff < 0) diff = Math.abs(diff);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    if (days > 0) return `${days} hari lalu`;
    if (hours > 0) return `${hours} jam lalu`;
    if (minutes > 0) return `${minutes} menit lalu`;
    return 'Baru saja';
  };

  const filteredChapters = chapters
    .filter(
      (chapter) =>
        searchChapter === '' ||
        chapter.title.toLowerCase().includes(searchChapter.toLowerCase()) ||
        chapter.number.toString().includes(searchChapter)
    )
    .sort((a, b) => {
      const numA = parseFloat(a.number);
      const numB = parseFloat(b.number);
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });

  const totalPages = Math.ceil(filteredChapters.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedChapters = filteredChapters.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchChapter, sortOrder]);

  const getPaginationItems = (current, total) => {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const items = [];
    items.push(1);

    if (current > 3) {
      items.push('ellipsis-1');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      if (!items.includes(i)) {
        items.push(i);
      }
    }

    if (current < total - 2) {
      items.push('ellipsis-2');
    }

    if (!items.includes(total)) {
      items.push(total);
    }

    return items;
  };

  const handleDownloadChapterPdf = async (chapter, event) => {
    event?.stopPropagation?.();
    if (!chapter?.slug) return;
    setDownloadingChapterSlug(chapter.slug);
    try {
      await downloadChapterPdf({
        slug: chapter.slug,
        mangaTitle: manga?.title,
        chapterNumber: chapter.number,
      });
      toast.success(`PDF Chapter ${chapter.number} berhasil diunduh`);
    } catch (err) {
      console.error('Download chapter PDF error:', err);
      toast.error(err.message || 'Gagal mengunduh chapter PDF');
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-red-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Memuat komik...</p>
        </div>
      </div>
    );
  }

  if (error || !manga) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Manga tidak ditemukan'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://komiknesia.com';
  const pageUrl = `${siteUrl}/komik/${slug}`;
  const mangaShareUrl = pageUrl;

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <Helmet>
        <title>{manga?.title ? `${manga.title} Bahasa Indonesia - KomikNesia` : 'KomikNesia'}</title>
        <meta name="description" content={`Baca ${manga?.title || 'komik'} Bahasa Indonesia di KomikNesia.`} />
        <link rel="canonical" href={pageUrl} />
      </Helmet>

      {/* Header Navigation */}
      <header className="bg-black/90 backdrop-blur-md border-b border-white/10 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3.5">
            <button
              type="button"
              onClick={() => navigate('/content')}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
              title="Kembali ke daftar komik"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
                title="Beranda"
              >
                <Home className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/premium')}
                className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 transition-colors text-white shadow-md"
                title="Premium"
              >
                <Crown className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="pt-20 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

          {/* 1. HERO BANNER & POSTER CARD */}
          <div className="relative overflow-hidden rounded-2xl bg-white/[0.04] border border-white/10 p-6 backdrop-blur-md shadow-2xl">
            <div
              className="absolute inset-0 scale-125 bg-cover bg-center blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundImage: `url(${getImageUrl(manga.cover)})` }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/80 to-black pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Poster Image */}
              <div className="w-40 sm:w-44 aspect-[3/4] shrink-0 overflow-hidden rounded-2xl shadow-2xl border border-white/15">
                <LazyImage
                  src={getImageUrl(manga.cover)}
                  alt={manga.title}
                  className="w-full h-full object-cover block"
                  wrapperClassName="block w-full h-full"
                />
              </div>

              {/* Title & Action Buttons */}
              <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left justify-between h-full">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1.5">
                    {manga.title}
                  </h1>
                  {manga.alternative_name && (
                    <p className="text-xs sm:text-sm text-gray-400 mb-3 line-clamp-2">
                      {manga.alternative_name}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6">
                    <span className="px-3 py-1 bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-bold rounded-lg uppercase">
                      {manga.content_type || 'MANHWA'}
                    </span>
                    <span className="px-3 py-1 bg-white/10 border border-white/15 text-gray-300 text-xs font-bold rounded-lg uppercase">
                      {manga.status || 'ONGOING'}
                    </span>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="w-full flex flex-col gap-2.5 max-w-md">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => {
                        if (chapters.length > 0) openChapter(navigate, chapters[chapters.length - 1], false);
                      }}
                      disabled={chapters.length === 0}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-3 text-xs font-bold text-white shadow-lg hover:bg-red-700 active:scale-[0.99] disabled:opacity-50 transition-all"
                    >
                      <Play className="h-4 w-4 shrink-0" />
                      FIRST CHAPTER
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (chapters.length > 0) openChapter(navigate, chapters[0], true);
                      }}
                      disabled={chapters.length === 0}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-3 text-xs font-bold text-white shadow-lg hover:bg-red-700 active:scale-[0.99] disabled:opacity-50 transition-all"
                    >
                      <Play className="h-4 w-4 shrink-0" />
                      LAST CHAPTER
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => toggleBookmark()}
                      disabled={bookmarkChecking}
                      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition active:scale-[0.99] ${
                        bookmarked
                          ? 'bg-violet-600 text-white shadow-md hover:bg-violet-500'
                          : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                      }`}
                    >
                      <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} />
                      {bookmarked ? 'BOOKMARKED' : 'BOOKMARK'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openReadlistPicker()}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 p-2.5 text-xs font-bold text-white hover:bg-white/20 border border-white/10 transition-all"
                    >
                      <ListChecks className="h-4 w-4" />
                      READLIST
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ADS BANNER */}
          {chapterTopAds.length > 0 && (
            <div>
              <AdBanner ads={chapterTopAds} layout="grid" columns={2} />
            </div>
          )}

          {/* 3. SECTION LINK ATAS: PREMIUM & SHARE KOMIK */}
          <div className="grid grid-cols-2 gap-2 mb-4 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/premium')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-black/90 backdrop-blur-md px-3 py-3 shadow-md transition-all hover:scale-[1.02] hover:border-amber-400/50 hover:bg-white/10"
            >
              <Crown className="h-5 w-5 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-xs font-bold text-white sm:text-sm">PREMIUM</span>
            </button>

            <button
              type="button"
              onClick={() => setSharePopupOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/90 backdrop-blur-md px-3 py-3 shadow-md transition-all hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
            >
              <Share2 className="h-5 w-5 text-red-500 shrink-0" />
              <span className="text-xs font-bold text-white sm:text-sm">SHARE KOMIK</span>
            </button>
          </div>

          {/* 4. DETAIL INFO & REKOMENDASI TAB CARD (TAROH DI BAWAH SHARE KOMIK) */}
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
            {/* Header Tab Switcher */}
            <div className="flex justify-start gap-2 mb-6 border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => setActiveTab('chapters')}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  activeTab === 'chapters'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <BookOpen className="h-4 w-4 inline-block mr-1.5" />
                Detail Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rekomendasi')}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  activeTab === 'rekomendasi'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <ThumbsUp className="h-4 w-4 inline-block mr-1.5" />
                REKOMENDASI
              </button>
            </div>

            {/* TAB CONTENT 1: DETAIL INFO (Series Information & Synopsis) */}
            {activeTab === 'chapters' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-red-500">ℹ️</span> Series Information
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* Metadata Specs */}
                    <div className="md:col-span-8 space-y-3 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">TYPE</span>
                        <span className="font-semibold text-white">{manga.content_type || 'Manhwa'}</span>
                      </div>

                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">STATUS</span>
                        <span className="font-semibold text-white capitalize">{manga.status || 'Ongoing'}</span>
                      </div>

                      {manga.alternative_name && (
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">ALTERNATIVE TITLES</span>
                          <span className="font-medium text-gray-300 line-clamp-2">{manga.alternative_name}</span>
                        </div>
                      )}

                      {manga.author && (
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider">AUTHORS</span>
                          <span className="font-semibold text-white">{manga.author}</span>
                        </div>
                      )}

                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1.5">GENRES</span>
                        <div className="flex flex-wrap gap-1.5">
                          {manga.genres?.map((g) => (
                            <span
                              key={g.id}
                              onClick={() => navigate(`/content?genre=${encodeURIComponent(g.name)}`)}
                              className="px-2.5 py-1 rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 font-bold text-[10px] uppercase cursor-pointer hover:bg-red-600 hover:text-white transition-all"
                            >
                              {g.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Rating & Views Box */}
                    <div className="md:col-span-4 bg-[#121218] border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center justify-center gap-4 text-center shadow-xl w-full">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 fill-amber-400 text-amber-400 shrink-0" />
                        <span className="text-lg sm:text-xl font-black text-white tabular-nums">
                          {manga.rating ? Number(manga.rating).toFixed(1) : '8.8'}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-white/15" />
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-gray-300 shrink-0" />
                        <span className="text-base sm:text-lg font-bold text-white tabular-nums">
                          {(Number(manga.total_views) || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Synopsis Section */}
                <div className="border-t border-white/10 pt-4">
                  <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <span className="text-red-500">≡</span> Synopsis
                  </h2>
                  <div
                    className={`prose prose-sm max-w-none text-gray-300 leading-relaxed transition-all duration-300 ${
                      synopsisExpanded ? '' : 'line-clamp-3'
                    }`}
                    dangerouslySetInnerHTML={{ __html: manga.sinopsis || 'Tidak ada sinopsis tersedia.' }}
                  />
                  {manga.sinopsis && manga.sinopsis.length > 150 && (
                    <button
                      type="button"
                      onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                      className="mt-2 text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1"
                    >
                      {synopsisExpanded ? 'SHOW LESS ▲' : 'SHOW MORE ▼'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: REKOMENDASI */}
            {activeTab === 'rekomendasi' && (
              <div className="py-2">
                <div className="mb-6">
                  <h2 className="text-lg font-extrabold text-white">Mirip dengan series ini</h2>
                  <p className="text-xs text-gray-400 mt-1">Rekomendasi komik seru dengan genre serupa</p>
                </div>

                {recommendedLoading ? (
                  <div className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-xs">Memuat komik rekomendasi...</p>
                  </div>
                ) : recommendedManga.length === 0 ? (
                  <p className="text-gray-400 text-sm">Tidak ada rekomendasi komik lain saat ini.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4">
                    {recommendedManga.map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => navigate(`/komik/${rec.slug}`)}
                        className="bg-white/[0.06] border border-white/10 rounded-xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all flex flex-col justify-between"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden">
                          <LazyImage
                            src={getImageUrl(rec.cover)}
                            alt={rec.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                            wrapperClassName="h-full w-full"
                          />
                        </div>
                        <div className="p-3">
                          <h3 className="text-xs font-bold text-white line-clamp-2 group-hover:text-red-400 transition-colors">
                            {rec.title}
                          </h3>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. LIST CHAPTER SECTION */}
          <div>
            {listChapterAds.length > 0 && (
              <div className="mb-6">
                <AdBanner ads={listChapterAds} layout="grid" columns={2} />
              </div>
            )}

            {/* List Chapter Header, Search Bar & Sort Toggle */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.04] border border-white/10 p-4 rounded-2xl backdrop-blur-md">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-red-500" />
                List Chapter ({chapters.length})
              </h2>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    placeholder="Cari Chapter Ex: 99..."
                    value={searchChapter}
                    onChange={(e) => setSearchChapter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white/5 text-gray-100 placeholder:text-gray-500 text-xs"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                </div>

                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2.5 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all"
                  title={sortOrder === 'asc' ? 'Urut dari Chapter 1' : 'Urut dari Chapter Terakhir'}
                >
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Chapter List View */}
            <div className="space-y-3">
              {paginatedChapters.map((chapter) => {
                const isLatest = isLatestChapterInList(chapters, chapter.slug);
                const chapterLocked = requiresChapterLogin(chapter, isAuthenticated);
                const isRead = readChapterSlugs.has(chapter.slug) || readChapterSlugs.has(chapter.id);
                const thumbUrl = customThumbnails[chapter.slug] || getImageUrl(chapter.thumbnail || manga?.cover);

                return (
                  <div
                    key={chapter.id}
                    onClick={() => openChapter(navigate, chapter, isLatest)}
                    className={`rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer flex items-center justify-between gap-3 p-3 bg-[#0a0a0e] border ${
                      chapterLocked
                        ? 'border-amber-500/30'
                        : 'border-white/10 hover:border-red-500/50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg bg-gray-950 border border-white/10 group/thumb">
                        <LazyImage
                          src={thumbUrl}
                          alt={chapter.title}
                          className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${isRead ? 'opacity-50' : ''}`}
                          wrapperClassName="h-full w-full"
                        />
                        <label
                          htmlFor={`thumb-upload-${chapter.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-0 bg-black/70 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          title="Ganti Foto Cover"
                        >
                          <PencilLine className="h-4 w-4 text-white" />
                        </label>
                        <input
                          type="file"
                          id={`thumb-upload-${chapter.slug}`}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            e.stopPropagation();
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                try {
                                  localStorage.setItem(`komiknesia_custom_ch_thumb_${chapter.slug}`, ev.target.result);
                                  setCustomThumbnails((prev) => ({ ...prev, [chapter.slug]: ev.target.result }));
                                  toast.success('Foto thumbnail chapter diperbarui');
                                } catch {
                                  toast.error('Foto terlalu besar');
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className={`mb-1 flex items-center gap-1.5 text-sm sm:text-base transition-colors ${isRead ? 'text-gray-500 font-medium' : 'text-white font-extrabold'}`}>
                          <span className="min-w-0 truncate">{chapter.title}</span>
                          {chapterLocked && <Lock className="h-3.5 w-3.5 text-amber-400" />}
                        </h3>
                        <p className="text-xs text-gray-400 mb-1">
                          {formatTimeAgo(chapter.uploadedAt)}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                            <Eye className="h-3.5 w-3.5 text-gray-400" />
                            <span>{(Number(chapter.views ?? chapter.view_count) || 0).toLocaleString('id-ID')} lihat</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                            <span>{(Number(chapter.reaction_count ?? chapter.reactionCount ?? chapter.likes ?? chapter.votes) || 0).toLocaleString('id-ID')} reaksi</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                      {isLatest && (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          NEW
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDownloadChapterPdf(chapter, e)}
                        disabled={downloadingChapterSlug === chapter.slug}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black transition-all font-bold text-xs disabled:opacity-50"
                        title="DOWNLOAD PDF (VIP)"
                      >
                        {downloadingChapterSlug === chapter.slug ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">DOWNLOAD PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination (Max 4-5 buttons + ellipsis + last page) */}
            {filteredChapters.length > 0 && totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {getPaginationItems(currentPage, totalPages).map((item) => {
                  if (typeof item === 'string') {
                    return (
                      <span key={item} className="px-2 text-xs font-bold text-gray-500">
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        currentPage === item
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-40"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* 6. SECTION LINK BAWAH: DISCORD & DONASI */}
          <div className="grid grid-cols-2 gap-2 mt-6 sm:gap-3">
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/90 backdrop-blur-md px-3 py-3 shadow-md transition-all hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]">
                <img src={discordIcon} alt="" className="h-4 w-4" aria-hidden />
              </div>
              <span className="text-xs font-bold text-white sm:text-sm">Discord</span>
            </a>

            <a
              href={donateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/90 backdrop-blur-md px-3 py-3 shadow-md transition-all hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
            >
              <Heart className="h-5 w-5 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-xs font-bold text-white sm:text-sm">Donasi</span>
            </a>
          </div>

          {/* 7. REAKSI KOMIK (DI ATAS KOMENTAR) */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md shadow-xl">
            <div className="mb-4 text-center">
              <h3 className="text-base sm:text-lg font-bold text-white">Reaksi Komik Ini</h3>
              <p className="mt-0.5 text-xs text-gray-400">
                {sumReactionCounts(mangaReactionData).toLocaleString('id-ID')} reaksi pembaca
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {REACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleMangaReaction(opt.id)}
                  disabled={mangaReactionLoading}
                  className={`flex min-w-[4.5rem] flex-col items-center rounded-xl border px-3 py-2.5 transition-all ${
                    selectedMangaReaction === opt.id
                      ? 'border-red-500 bg-red-950/50 ring-2 ring-red-500/60'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  } ${mangaReactionLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <img
                    src={opt.image}
                    alt={opt.label}
                    className="h-10 w-10 object-contain"
                  />
                  <span className="mt-1 text-[11px] font-medium text-gray-300">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 text-xs font-semibold text-gray-200">
                    {mangaReactionData[opt.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 8. COMMENT SECTION */}
          <div className="mt-8">
            <CommentSection mangaId={manga?.id} externalSlug={slug} />
          </div>

        </div>
      </main>

      <LoginModal open={loginOpen} onClose={closeLogin} onSuccess={handleLoginSuccess} />

      {/* Modal Popup Bagikan Komik */}
      {sharePopupOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Bagikan Komik Ini"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 text-left shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Bagikan Komik Ini</h3>
              <button
                type="button"
                onClick={() => setSharePopupOpen(false)}
                className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-400">
              Pilih cara membagikan tautan komik ini ke teman atau medsos kamu.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(mangaShareUrl);
                    toast.success('Link disalin ke clipboard');
                  } catch {
                    toast.error('Gagal menyalin link');
                  }
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-600">
                  <Copy className="h-5 w-5" aria-hidden />
                </span>
                <span>Salin tautan</span>
              </button>

              <WhatsappShareButton
                url={mangaShareUrl}
                title={manga?.title ? manga.title : 'KomikNesia'}
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
                title={manga?.title ? manga.title : 'KomikNesia'}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                resetButtonStyle={false}
                onClick={() => setSharePopupOpen(false)}
              >
                <TwitterIcon size={40} round />
                <span>X (Twitter)</span>
              </TwitterShareButton>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(mangaShareUrl);
                    toast.success('Link disalin ke clipboard');
                  } catch {
                    toast.error('Gagal menyalin link');
                  }
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-lg font-bold tracking-tight text-white ring-1 ring-white/20" aria-hidden>
                  TT
                </span>
                <span>TikTok</span>
              </button>

              <TelegramShareButton
                url={mangaShareUrl}
                title={manga?.title ? manga.title : 'KomikNesia'}
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

      <BottomNavigation />
      <LiveChatWidget />

      <LoginModal
        open={loginOpen}
        onClose={closeLogin}
        onSuccess={() => handleLoginSuccess(navigate)}
      />
    </div>
  );
};

export default MangaDetail;

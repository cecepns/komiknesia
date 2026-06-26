import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft,
  Home,
  ChevronLeft,
  ChevronRight,
  List,
  X,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Sparkles,
  Coffee,
  ExternalLink,
  Eye,
  Share2,
  Copy,
  Heart,
  AlertTriangle,
} from 'lucide-react';
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
import LazyImage from '../components/LazyImage';
import { saveToHistory } from '../utils/historyManager';
import { API_BASE_URL, apiClient, getImageUrl } from '../utils/api';
import AdBanner from '../components/AdBanner';
import { useAds } from '../hooks/useAds';
import CommentSection from '../components/CommentSection';
import { useAuth } from '../contexts/AuthContext';
import { REACTION_OPTIONS, emptyReactionCounts, sumReactionCounts } from '../constants/reactions';
import LoginModal from '../components/LoginModal';
import {
  requiresChapterLogin,
  normalizeChapterImage,
  isChapterAccessLocked,
  isLatestChapterInList,
  findChapterInList,
} from '../utils/chapterAccess';

/** Kontrol auto scroll — hanya untuk user premium. */
const SHOW_AUTO_SCROLL_UI = true;

/** Kecepatan auto-scroll dalam px/detik per nilai slider (0 = paling pelan). */
const AUTO_SCROLL_PX_PER_SEC = [6, 12, 22, 38, 58, 85, 115, 155, 200];

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
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(2);
  const [showResumeAutoPlay, setShowResumeAutoPlay] = useState(false);
  const autoScrollTimerRef = useRef(null);
  const autoScrollAccumRef = useRef(0);
  const topRef = useRef(null);
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingChapterSlug, setPendingChapterSlug] = useState(null);
  const isPremiumUser = !!user?.membership_active;
  const discordInviteUrl = 'https://discord.gg/3tGVDZCF3a';
  const donateUrl = 'https://saweria.co/KomikNesia';
  const chapterOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://komiknesia.com';
  const chapterShareUrl = chapterSlug ? `${chapterOrigin}/view/${chapterSlug}` : '';
  const [chapterSharePopupOpen, setChapterSharePopupOpen] = useState(false);

  const copyChapterShareLink = async (context = 'default') => {
    if (!chapterShareUrl) return;
    try {
      await navigator.clipboard.writeText(chapterShareUrl);
      if (context === 'tiktok') {
        toast.success('Link disalin. Buka TikTok dan tempel di bio, DM, atau caption.');
      } else {
        toast.success('Tautan chapter berhasil disalin.');
      }
    } catch {
      toast.error('Gagal menyalin. Salin manual: ' + chapterShareUrl);
    }
  };

  const [chapterReactionData, setChapterReactionData] = useState(() => emptyReactionCounts());
  const [selectedChapterReaction, setSelectedChapterReaction] = useState(null);
  const [chapterReactionLoading, setChapterReactionLoading] = useState(false);

  useEffect(() => {
    if (!chapterSlug) return undefined;
    let cancelled = false;
    setChapterReactionLoading(true);
    apiClient
      .getChapterReactions(chapterSlug)
      .then((res) => {
        if (cancelled || !res?.status || !res.data) return;
        setChapterReactionData({ ...emptyReactionCounts(), ...res.data });
        setSelectedChapterReaction(res.userReaction ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChapterReactionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chapterSlug]);

  const handleChapterReaction = async (reactionType) => {
    if (!chapterSlug) return;
    setChapterReactionLoading(true);
    try {
      const result = await apiClient.submitChapterReaction(chapterSlug, reactionType);
      if (result?.status) {
        const refresh = await apiClient.getChapterReactions(chapterSlug);
        if (refresh?.status && refresh.data) {
          setChapterReactionData({ ...emptyReactionCounts(), ...refresh.data });
          setSelectedChapterReaction(refresh.userReaction ?? null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChapterReactionLoading(false);
    }
  };

  const fetchChapterData = useCallback(async () => {
    if (!chapterSlug) return;

    try {
      setLoading(true);
      setError(null);

      const token = apiClient.getAuthToken();
      const response = await fetch(`${API_BASE_URL}/chapters/slug/${chapterSlug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Chapter tidak ditemukan');
      }

      const result = await response.json();

      if (result.status && result.data) {
        const chapters = result.data.chapters || [];
        const index = chapters.findIndex((ch) => ch.slug === chapterSlug);
        const currentChapter = index >= 0 ? chapters[index] : null;
        const isLoggedIn = isAuthenticated || !!token;
        const locked = isChapterAccessLocked(chapters, chapterSlug, isLoggedIn);

        setChapterData({
          ...result.data,
          images: locked ? [] : result.data.images || [],
        });

        const extractedMangaSlug = result.data.content?.slug || result.data.content?.id;
        setMangaSlug(extractedMangaSlug);
        setCurrentChapterIndex(index);

        if (!locked && extractedMangaSlug) {
          try {
            await fetch(`${API_BASE_URL}/comic/${extractedMangaSlug}/view`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (viewError) {
            console.warn('Failed to increment view counter:', viewError);
          }
        }

        if (!locked && currentChapter && result.data.content) {
          saveToHistory({
            mangaSlug: extractedMangaSlug,
            mangaTitle: result.data.content.title,
            cover: result.data.content.cover,
            chapterSlug: currentChapter.slug,
            chapterNumber: currentChapter.number || currentChapter.chapter_number || null,
            chapterTitle: currentChapter.title || null,
            chapterCreatedAt: currentChapter.created_at || null,
            isLatestChapter: isLatestChapterInList(chapters, chapterSlug),
          });
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
  }, [chapterSlug, isAuthenticated]);

  useEffect(() => {
    if (chapterSlug) {
      setCurrentChapterIndex(-1);
      fetchChapterData();
    }
  }, [chapterSlug, fetchChapterData]);

  useEffect(() => {
    if (!chapterSlug) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [chapterSlug]);

  const allChapters = chapterData?.chapters || [];
  const mangaData = chapterData?.content || null;

  // Fetch ads for manga-detail-top and manga-detail-bottom
  const { ads: mangaDetailTopAds } = useAds('manga-detail-top');
  const { ads: mangaDetailBottomAds } = useAds('manga-detail-bottom');

  const handlePrevChapter = () => {
    if (currentChapterIndex < allChapters.length - 1) {
      const prevChapter = allChapters[currentChapterIndex + 1];
      navigate(`/view/${prevChapter.slug}`);
    }
  };

  const isLoggedIn = isAuthenticated || !!apiClient.getAuthToken();

  const handleNextChapter = () => {
    if (currentChapterIndex > 0) {
      const nextChapter = allChapters[currentChapterIndex - 1];
      if (isChapterAccessLocked(allChapters, nextChapter.slug, isLoggedIn)) {
        setPendingChapterSlug(nextChapter.slug);
        setLoginOpen(true);
        return;
      }
      navigate(`/view/${nextChapter.slug}`);
    }
  };

  const handleChapterSelect = (chapter) => {
    if (requiresChapterLogin(chapter, isLoggedIn)) {
      setPendingChapterSlug(chapter.slug);
      setShowChapterList(false);
      setLoginOpen(true);
      return;
    }
    setPendingChapterSlug(null);
    navigate(`/view/${chapter.slug}`);
    setShowChapterList(false);
  };

  const hasPrevChapter = currentChapterIndex < allChapters.length - 1;
  const hasNextChapter = currentChapterIndex > 0;

  // Handle scroll detection for showing scroll buttons (rAF + passive = less main-thread jank)
  useEffect(() => {
    let rafScheduled = false;
    const handleScroll = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        setShowScrollButtons(scrollTop > 300);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll functions - scroll incrementally for better reading experience
  const scrollUp = () => {
    if (SHOW_AUTO_SCROLL_UI && autoScrollEnabled) {
      setAutoScrollEnabled(false);
      setShowResumeAutoPlay(true);
    }
    const scrollAmount = 600; // Scroll 600px at a time
    const currentPosition = window.pageYOffset || document.documentElement.scrollTop;
    window.scrollTo({ 
      top: Math.max(0, currentPosition - scrollAmount), 
      behavior: 'smooth' 
    });
  };

  const scrollDown = () => {
    if (SHOW_AUTO_SCROLL_UI && autoScrollEnabled) {
      setAutoScrollEnabled(false);
      setShowResumeAutoPlay(true);
    }
    const scrollAmount = 600; // Scroll 600px at a time
    const currentPosition = window.pageYOffset || document.documentElement.scrollTop;
    window.scrollTo({ 
      top: currentPosition + scrollAmount, 
      behavior: 'smooth' 
    });
  };

  useEffect(() => {
    if (!isPremiumUser || !SHOW_AUTO_SCROLL_UI || !autoScrollEnabled) {
      if (autoScrollTimerRef.current != null) {
        cancelAnimationFrame(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
      return;
    }

    autoScrollAccumRef.current = 0;
    const speedIdx = Math.min(
      AUTO_SCROLL_PX_PER_SEC.length - 1,
      Math.max(0, Number(autoScrollSpeed) || 0)
    );
    const pxPerSec = AUTO_SCROLL_PX_PER_SEC[speedIdx];

    let lastTs = null;
    const tick = (now) => {
      if (lastTs == null) lastTs = now;
      const dt = Math.min(100, now - lastTs);
      lastTs = now;
      autoScrollAccumRef.current += (pxPerSec * dt) / 1000;
      const step = Math.floor(autoScrollAccumRef.current);
      if (step > 0) {
        window.scrollBy({ top: step, left: 0, behavior: 'auto' });
        autoScrollAccumRef.current -= step;
      }
      // Selalu simpan id frame terbaru agar cleanup membatalkan seluruh rantai RAF,
      // bukan hanya frame pertama (tanpa ini auto-scroll tetap jalan setelah pause).
      autoScrollTimerRef.current = requestAnimationFrame(tick);
    };
    autoScrollTimerRef.current = requestAnimationFrame(tick);

    return () => {
      if (autoScrollTimerRef.current != null) {
        cancelAnimationFrame(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
      autoScrollAccumRef.current = 0;
    };
  }, [isPremiumUser, autoScrollEnabled, autoScrollSpeed]);

  // Turn off auto-scroll when user manually scrolls/interacts.
  useEffect(() => {
    if (!isPremiumUser || !SHOW_AUTO_SCROLL_UI) return;

    const disableAutoScrollByUser = () => {
      if (!SHOW_AUTO_SCROLL_UI || !autoScrollEnabled) return;
      setAutoScrollEnabled(false);
      setShowResumeAutoPlay(true);
    };

    const onKeyDown = (event) => {
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
      if (scrollKeys.includes(event.key)) {
        disableAutoScrollByUser();
      }
    };

    window.addEventListener('wheel', disableAutoScrollByUser, { passive: true });
    window.addEventListener('touchmove', disableAutoScrollByUser, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('wheel', disableAutoScrollByUser);
      window.removeEventListener('touchmove', disableAutoScrollByUser);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isPremiumUser, SHOW_AUTO_SCROLL_UI, autoScrollEnabled]);

  const chapterLocked =
    !authLoading && isChapterAccessLocked(allChapters, chapterSlug, isLoggedIn);

  useEffect(() => {
    if (chapterLocked && !loginOpen) {
      setLoginOpen(true);
    }
  }, [chapterLocked, loginOpen]);

  if (loading || authLoading) {
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

  const currentChapter =
    findChapterInList(allChapters, chapterSlug) ||
    (currentChapterIndex >= 0 ? allChapters[currentChapterIndex] : null);
  const chapterNumber = currentChapter?.number || chapterData?.number;
  const mangaTitle = mangaData?.title || chapterData?.title || 'KomikNesia';
  const pageTitle = `${mangaTitle} Chapter ${chapterNumber} Bahasa Indonesia | KomikNesia`;
  const pageDescription = `Baca ${mangaTitle} chapter ${chapterNumber} bahasa Indonesia terbaru di KomikNesia. Episode terbaru, Update cepat, kualitas gambar jernih, dan mudah dibaca.`;
  const chapterShareTitle = `Baca ${mangaTitle} chapter ${chapterNumber} bahasa Indonesia di KomikNesia`;

  return (
    <div ref={topRef} className="min-h-screen bg-primary-950 text-gray-100">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={chapterShareUrl} />
      </Helmet>
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
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3 shrink-0" aria-hidden />
                        {(Number(chapter.views) || 0).toLocaleString('id-ID')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3 shrink-0 text-amber-400/80" aria-hidden />
                        {(Number(chapter.reaction_count) || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
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
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-4 w-4 shrink-0" aria-hidden />
                {(Number(currentChapter?.views) || 0).toLocaleString('id-ID')} lihat chapter
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-300/90" aria-hidden />
                {sumReactionCounts(chapterReactionData).toLocaleString('id-ID')} reaksi
              </span>
            </div>
            {isPremiumUser && SHOW_AUTO_SCROLL_UI && (
              <div className="mt-4 max-w-md mx-auto rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAutoScrollEnabled((prev) => {
                        const next = !prev;
                        if (next) {
                          setShowResumeAutoPlay(false);
                        }
                        return next;
                      });
                    }}
                    className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center gap-2"
                  >
                    {autoScrollEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {autoScrollEnabled ? 'Pause Auto Scroll' : 'Play Auto Scroll'}
                  </button>
                  <div className="flex-1 text-left">
                    <label className="block text-xs text-gray-300 mb-1">Kecepatan Auto Scroll</label>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={1}
                      value={autoScrollSpeed}
                      onChange={(e) => setAutoScrollSpeed(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ad Banner - Top of Images (min-height mengurangi CLS + area iklan konsisten) */}
          {!isPremiumUser && mangaDetailTopAds.length > 0 && (
            <div className="px-3 sm:px-4 mb-6 min-h-[80px] sm:min-h-[90px] md:min-h-[100px]">
              <AdBanner
                ads={mangaDetailTopAds}
                layout="grid"
                columns={1}
              />
            </div>
          )}

          {chapterLocked ? (
            <div className="px-3 sm:px-4 py-16 text-center">
              <p className="mb-2 text-lg font-semibold text-white">Chapter terkunci</p>
              <p className="mb-6 text-sm text-gray-400">
                Chapter ini baru rilis kurang dari 2 jam. Login untuk membaca sekarang, atau tunggu hingga 2 jam setelah rilis untuk baca tanpa login.
              </p>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
              >
                Login untuk melanjutkan
              </button>
            </div>
          ) : (
          <div className="webtoon-pages space-y-0 flex flex-col gap-0 p-0 m-0">
            {chapterData?.images && chapterData.images.length > 0 ? (
              chapterData.images.map((image, index) => {
                const { src } = normalizeChapterImage(image);
                return (
                <div
                  key={index}
                  className="w-full m-0 p-0 leading-[0] overflow-hidden"
                >
                  <LazyImage
                    src={getImageUrl(src)}
                    alt={`Page ${index + 1}`}
                    className="w-full h-auto block align-bottom m-0 p-0 border-0 outline-none"
                    wrapperClassName="w-full block m-0 p-0 leading-[0] min-h-0"
                    loadingClassName="min-h-[42vh] sm:min-h-[56vh] md:min-h-[64vh]"
                  />
                </div>
                );
              })
            ) : (
              <div className="text-center py-12 px-4 text-gray-400 text-sm sm:text-base">
                Tidak ada gambar tersedia untuk chapter ini
              </div>
            )}
          </div>
          )}

          {/* Bagikan chapter, Discord, Donasi, Lapor error */}
          <div className="px-3 sm:px-4 pt-4 pb-2">
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
              <button
                type="button"
                onClick={() => setChapterSharePopupOpen(true)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-slate-700/90 bg-[#111827] p-3.5 text-left shadow-md transition-all hover:border-slate-600 hover:bg-slate-800/95 sm:gap-4 sm:p-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-inner sm:h-12 sm:w-12">
                  <Share2 className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white sm:text-base">Bagikan chapter</p>
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

              <button
                type="button"
                onClick={() => {
                  const q = new URLSearchParams({
                    topic: 'lapor-error-komik',
                    chapter: chapterSlug || '',
                  });
                  if (mangaSlug) q.set('manga', mangaSlug);
                  const title = mangaData?.title || chapterData?.title;
                  if (title) q.set('judul', title);
                  navigate(`/contact?${q.toString()}`);
                }}
                className="group flex w-full items-center gap-3 rounded-2xl border border-slate-700/90 bg-[#111827] p-3.5 text-left shadow-md transition-all hover:border-rose-500/40 hover:bg-slate-800/95 sm:gap-4 sm:p-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-inner sm:h-12 sm:w-12">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white sm:text-base">Lapor komik error</p>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    Gambar putus, urutan salah, atau hal lain — ke halaman kontak
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300 sm:h-5 sm:w-5"
                  aria-hidden
                />
              </button>
            </div>
          </div>

          {chapterSharePopupOpen && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Bagikan chapter"
            >
              <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 text-left shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Bagikan chapter ini</h3>
                  <button
                    type="button"
                    onClick={() => setChapterSharePopupOpen(false)}
                    className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Tutup"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <p className="mb-4 text-sm text-slate-400">
                  Pilih cara membagikan tautan chapter ini ke teman atau medsos kamu.
                </p>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      copyChapterShareLink('default');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-600">
                      <Copy className="h-5 w-5" aria-hidden />
                    </span>
                    <span>Salin tautan</span>
                  </button>

                  <WhatsappShareButton
                    url={chapterShareUrl}
                    title={chapterShareTitle}
                    separator=" — "
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                    resetButtonStyle={false}
                    onClick={() => setChapterSharePopupOpen(false)}
                  >
                    <WhatsappIcon size={40} round />
                    <span>WhatsApp</span>
                  </WhatsappShareButton>

                  <TwitterShareButton
                    url={chapterShareUrl}
                    title={chapterShareTitle}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                    resetButtonStyle={false}
                    onClick={() => setChapterSharePopupOpen(false)}
                  >
                    <TwitterIcon size={40} round />
                    <span>X (Twitter)</span>
                  </TwitterShareButton>

                  <button
                    type="button"
                    onClick={() => {
                      copyChapterShareLink('tiktok');
                    }}
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
                    url={chapterShareUrl}
                    title={chapterShareTitle}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                    resetButtonStyle={false}
                    onClick={() => setChapterSharePopupOpen(false)}
                  >
                    <TelegramIcon size={40} round />
                    <span>Telegram</span>
                  </TelegramShareButton>
                </div>
              </div>
            </div>
          )}

          {/* Reaksi chapter */}
          <div className="px-3 sm:px-4 py-6">
            <div className="rounded-2xl border border-primary-800 bg-primary-900/90 p-4 sm:p-6">
              <div className="mb-4 text-center">
                <h3 className="text-lg font-bold text-white sm:text-xl">Reaksi chapter ini</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {sumReactionCounts(chapterReactionData).toLocaleString('id-ID')} reaksi
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                {REACTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChapterReaction(opt.id)}
                    disabled={chapterReactionLoading}
                    className={`flex min-w-[4.5rem] flex-col items-center rounded-xl border px-2 py-2 transition-all sm:min-w-[5.5rem] sm:px-3 sm:py-2.5 ${
                      selectedChapterReaction === opt.id
                        ? 'border-purple-500 bg-purple-950/50 ring-2 ring-purple-400/60'
                        : 'border-primary-700 bg-primary-950/50 hover:border-primary-500'
                    } ${chapterReactionLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <img
                      src={opt.image}
                      alt={opt.label}
                      className="h-10 w-10 object-contain sm:h-12 sm:w-12"
                    />
                    <span className="mt-1 text-center text-[11px] font-medium text-gray-300 sm:text-xs">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 text-xs font-semibold text-gray-200">
                      {chapterReactionData[opt.id] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-[11px] text-gray-500">
                Klik untuk memberi reaksi atau mengubah pilihan
              </p>
            </div>
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

          {/* Ad Banner - Above Comment Section with Grid 2 */}
          {!isPremiumUser && mangaDetailBottomAds.length > 0 && (
            <div className="px-3 sm:px-4 mb-6 min-h-[100px] sm:min-h-[120px] md:min-h-[140px]">
              <AdBanner
                ads={mangaDetailBottomAds}
                layout="grid"
                columns={2}
              />
            </div>
          )}

          <div className="px-3 sm:px-4 mb-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">KASIH KOPI DISINI</p>
                  <p className="text-xs text-slate-400">Kopinya Kawan</p>
                </div>
                <div className="rounded-xl bg-white/10 p-2 text-emerald-300">
                  <Coffee className="h-4 w-4" />
                </div>
              </div>
              <a
                href={donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
              >
                <Coffee className="h-4 w-4" />
                Donasi
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Comment Section */}
          <div className="px-3 sm:px-4 pb-6 sm:pb-8">
            <CommentSection
              mangaId={mangaSlug || mangaData?.slug || mangaData?.id}
              chapterId={currentChapter?.id}
              externalSlug={chapterSlug}
            />
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
      <div className={`hidden md:flex fixed right-6 bottom-32 flex-col gap-2 z-50 transition-all duration-300 ${
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

      <LoginModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          setPendingChapterSlug(null);
        }}
        onSuccess={async () => {
          setLoginOpen(false);
          if (pendingChapterSlug) {
            navigate(`/view/${pendingChapterSlug}`);
            setPendingChapterSlug(null);
            return;
          }
          await fetchChapterData();
        }}
      />

      {SHOW_AUTO_SCROLL_UI && isPremiumUser && showResumeAutoPlay && !autoScrollEnabled && (
        <button
          type="button"
          onClick={() => {
            setAutoScrollEnabled(true);
            setShowResumeAutoPlay(false);
          }}
          className="fixed right-5 bottom-16 md:bottom-12 z-[60] h-14 w-14 rounded-full bg-gradient-to-br from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white shadow-[0_10px_30px_rgba(239,68,68,0.45)] transition-all duration-300 hover:scale-105 flex items-center justify-center"
          title="Lanjutkan Auto Scroll"
          aria-label="Lanjutkan Auto Scroll"
        >
          <div className="relative">
            <Play className="h-6 w-6 ml-0.5" />
            <Sparkles className="h-3.5 w-3.5 absolute -top-1.5 -right-1.5" />
          </div>
        </button>
      )}
    </div>
  );
};

export default ChapterReader;











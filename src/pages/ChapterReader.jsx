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
  ChevronUp,
  ChevronDown,
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
  Settings,
  Download,
  MessageSquare,
  Bookmark,
  Crown,
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
import { downloadChapterZip } from '../utils/downloadChapterZip';
import {
  requiresChapterLogin,
  normalizeChapterImage,
  isChapterAccessLocked,
  isLatestChapterInList,
  findChapterInList,
} from '../utils/chapterAccess';

/** Kecepatan auto-scroll dalam px/detik per nilai slider (0 = paling pelan). */
const AUTO_SCROLL_PX_PER_SEC = [10, 20, 35, 55, 80, 110, 150, 200, 260];

const ChapterReader = () => {
  const { chapterSlug } = useParams();
  const navigate = useNavigate();
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showChapterList, setShowChapterList] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);
  const [mangaSlug, setMangaSlug] = useState(null);

  // Settings & Controls States
  const [isControlsVisible, setIsControlsVisible] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [fitToWidth, setFitToWidth] = useState(false);
  const [readerImageWidth, setReaderImageWidth] = useState(900);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Auto Scroll States
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(2);
  const autoScrollTimerRef = useRef(null);
  const autoScrollAccumRef = useRef(0);
  const topRef = useRef(null);
  const commentSectionRef = useRef(null);

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
    setIsControlsVisible(false);
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

  // Track scroll for hiding UI controls
  const lastScrollYRef = useRef(0);
  useEffect(() => {
    let rafScheduled = false;
    const handleScroll = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
        // If user scrolls up or down, hide controls if they were visible
        if (Math.abs(currentScrollY - lastScrollYRef.current) > 5) {
          setIsControlsVisible(false);
        }
        lastScrollYRef.current = currentScrollY;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle tap/click on background/image to toggle controls visibility
  const handleMainAreaClick = (e) => {
    // Prevent toggle if clicking interactive elements, buttons, modals, or drawer
    if (
      e.target.closest('button') ||
      e.target.closest('a') ||
      e.target.closest('input') ||
      e.target.closest('[role="dialog"]') ||
      showChapterList ||
      showSettingsDrawer ||
      chapterSharePopupOpen
    ) {
      return;
    }
    setIsControlsVisible((prev) => !prev);
  };

  // Premium Alert Trigger
  const triggerPremiumAlert = (featureName) => {
    toast.info(
      <div className="flex flex-col gap-1 text-left">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <Crown className="h-4 w-4" /> Fitur Premium VIP!
        </div>
        <p className="text-xs text-gray-200">
          {featureName} hanya tersedia untuk member VIP. Yuk upgrade akun kamu!
        </p>
      </div>,
      { autoClose: 4000 }
    );
  };

  // Handle Settings Toggle Button
  const handleOpenSettings = () => {
    if (!isPremiumUser) {
      triggerPremiumAlert('Reader Settings');
      return;
    }
    setShowSettingsDrawer(true);
  };

  // Handle Auto Scroll Toggle Button
  const handleToggleAutoScroll = () => {
    if (!isPremiumUser) {
      triggerPremiumAlert('Auto Scroll');
      return;
    }
    setAutoScrollEnabled((prev) => !prev);
  };

  // Handle Download ZIP (Backend Endpoint)
  const handleDownloadZip = async () => {
    if (!chapterSlug) return;
    try {
      setDownloadingZip(true);
      toast.info('Menyiapkan download chapter ZIP...');
      await downloadChapterZip({
        slug: chapterSlug,
        mangaTitle: mangaData?.title || 'KomikNesia',
        chapterNumber: currentChapter?.number || chapterData?.number || '0',
      });
      toast.success('Chapter berhasil diunduh!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Gagal mengunduh chapter');
    } finally {
      setDownloadingZip(false);
    }
  };

  // Scroll functions
  const scrollUp = () => {
    if (autoScrollEnabled) setAutoScrollEnabled(false);
    const scrollAmount = 600;
    const currentPosition = window.pageYOffset || document.documentElement.scrollTop;
    window.scrollTo({ 
      top: Math.max(0, currentPosition - scrollAmount), 
      behavior: 'smooth' 
    });
  };

  const scrollDown = () => {
    if (autoScrollEnabled) setAutoScrollEnabled(false);
    const scrollAmount = 600;
    const currentPosition = window.pageYOffset || document.documentElement.scrollTop;
    window.scrollTo({ 
      top: currentPosition + scrollAmount, 
      behavior: 'smooth' 
    });
  };

  const scrollToComments = () => {
    if (commentSectionRef.current) {
      commentSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Auto Scroll Engine
  useEffect(() => {
    if (!isPremiumUser || !autoScrollEnabled) {
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

  // Turn off auto-scroll when user manually scrolls/interacts
  useEffect(() => {
    if (!isPremiumUser || !autoScrollEnabled) return;

    const disableAutoScrollByUser = () => {
      setAutoScrollEnabled(false);
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
  }, [isPremiumUser, autoScrollEnabled]);

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
    <div
      ref={topRef}
      onClick={handleMainAreaClick}
      className="min-h-screen bg-[#0d0e12] text-gray-100 relative select-none"
    >
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={chapterShareUrl} />
      </Helmet>

      {/* Floating Top Header Pill (Gambar 1) */}
      <header
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 w-[92%] max-w-xl ${
          isControlsVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-6 pointer-events-none'
        }`}
      >
        <div className="bg-[#181920]/90 backdrop-blur-md border border-white/10 rounded-full px-4 py-2.5 shadow-2xl flex items-center justify-between text-white">
          <button
            onClick={() => navigate(mangaSlug ? `/komik/${mangaSlug}` : '/')}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
            title="Kembali ke detail manga"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="text-center mx-3 min-w-0 flex-1">
            <h1 className="text-xs sm:text-sm font-semibold truncate tracking-wide text-gray-200 uppercase">
              {mangaData?.title || 'Loading...'}
            </h1>
            <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
              CHAPTER {currentChapter?.number || chapterData?.number}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setChapterSharePopupOpen(true)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
              title="Bagikan chapter"
            >
              <Share2 className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
              title="Ke beranda"
            >
              <Home className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Chapter List Modal */}
      {showChapterList && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-[#14151b] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <h2 className="text-base sm:text-lg font-bold text-white">Daftar Chapter</h2>
              <button
                onClick={() => setShowChapterList(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-2">
              {allChapters.map((chapter, index) => (
                <button
                  key={chapter.id}
                  onClick={() => handleChapterSelect(chapter)}
                  className={`w-full text-left p-3.5 rounded-xl transition-all ${
                    chapter.slug === chapterSlug
                      ? 'bg-rose-600 text-white font-semibold shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Chapter {chapter.number}</span>
                    {index === 0 && (
                      <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded font-bold">
                        NEW
                      </span>
                    )}
                  </div>
                  {chapter.title && chapter.title !== `Chapter ${chapter.number}` && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{chapter.title}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="min-h-screen py-0 px-0">
        <div
          className="mx-auto transition-all duration-200"
          style={{
            maxWidth: fitToWidth ? '100%' : `${readerImageWidth}px`,
          }}
        >
          {chapterLocked ? (
            <div className="px-4 py-24 text-center">
              <p className="mb-2 text-lg font-semibold text-white">Chapter Terkunci</p>
              <p className="mb-6 text-sm text-gray-400 max-w-md mx-auto">
                Chapter ini baru rilis kurang dari 2 jam. Login untuk membaca sekarang, atau tunggu hingga 2 jam setelah rilis untuk baca tanpa login.
              </p>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-500 shadow-lg"
              >
                Login untuk Melanjutkan
              </button>
            </div>
          ) : (
            <div className="webtoon-pages flex flex-col gap-0 p-0 m-0 select-none">
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
                        loadingClassName="min-h-[40vh] sm:min-h-[50vh]"
                      />
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-20 text-gray-400 text-sm">
                  Tidak ada gambar tersedia untuk chapter ini
                </div>
              )}
            </div>
          )}

          {/* Ad Banner - Top of Details */}
          {!isPremiumUser && mangaDetailTopAds.length > 0 && (
            <div className="px-4 my-6">
              <AdBanner ads={mangaDetailTopAds} layout="grid" columns={1} />
            </div>
          )}

          {/* Bagikan chapter, Discord, Donasi, Lapor error */}
          <div className="px-4 pt-8 pb-4">
            <div className="mx-auto grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => setChapterSharePopupOpen(true)}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#16171e] p-4 text-left hover:bg-white/10 transition-colors"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
                  <Share2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Bagikan chapter</p>
                  <p className="text-xs text-gray-400">Salin link, WA, TikTok</p>
                </div>
              </button>

              <a
                href={discordInviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#16171e] p-4 text-left hover:bg-white/10 transition-colors"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5865F2] text-white">
                  <img src={discordIcon} alt="" className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Discord</p>
                  <p className="text-xs text-gray-400">Komunitas pembaca</p>
                </div>
              </a>

              <a
                href={donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#16171e] p-4 text-left hover:bg-white/10 transition-colors"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <Heart className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Donasi</p>
                  <p className="text-xs text-gray-400">Dukung via Saweria</p>
                </div>
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
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#16171e] p-4 text-left hover:bg-white/10 transition-colors"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Lapor komik error</p>
                  <p className="text-xs text-gray-400">Gambar rusak / terputus</p>
                </div>
              </button>
            </div>
          </div>

          {/* Reaksi chapter */}
          <div className="px-4 py-4">
            <div className="rounded-2xl border border-white/10 bg-[#16171e] p-6">
              <div className="mb-4 text-center">
                <h3 className="text-lg font-bold text-white">Reaksi chapter ini</h3>
                <p className="mt-1 text-xs text-gray-400">
                  {sumReactionCounts(chapterReactionData).toLocaleString('id-ID')} reaksi
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {REACTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChapterReaction(opt.id)}
                    disabled={chapterReactionLoading}
                    className={`flex min-w-[4.5rem] flex-col items-center rounded-xl border px-3 py-2.5 transition-all ${
                      selectedChapterReaction === opt.id
                        ? 'border-purple-500 bg-purple-950/50 ring-2 ring-purple-400/60'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    } ${chapterReactionLoading ? 'cursor-not-allowed opacity-50' : ''}`}
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
                      {chapterReactionData[opt.id] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ad Banner - Bottom */}
          {!isPremiumUser && mangaDetailBottomAds.length > 0 && (
            <div className="px-4 my-6">
              <AdBanner ads={mangaDetailBottomAds} layout="grid" columns={2} />
            </div>
          )}

          {/* Comment Section Ref Target */}
          <div ref={commentSectionRef} className="px-4 py-6">
            <CommentSection
              mangaId={mangaSlug || mangaData?.slug || mangaData?.id}
              chapterId={currentChapter?.id}
              externalSlug={chapterSlug}
            />
          </div>
        </div>
      </main>

      {/* Floating Bottom Navigation Toolbar (Gambar 1) */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          isControlsVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-6 pointer-events-none'
        }`}
      >
        <div className="bg-[#181920]/90 backdrop-blur-md border border-white/10 rounded-full px-4 py-2.5 shadow-2xl flex items-center justify-center gap-3 sm:gap-4 text-gray-300">
          {/* Prev Chapter */}
          <button
            onClick={handlePrevChapter}
            disabled={!hasPrevChapter}
            className={`p-2 rounded-full transition-colors ${
              hasPrevChapter
                ? 'hover:bg-white/10 hover:text-white text-gray-200'
                : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Prev Chapter"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Settings Button */}
          <button
            onClick={handleOpenSettings}
            className="p-2 rounded-full hover:bg-white/10 hover:text-white transition-colors relative"
            title="Reader Settings"
          >
            <Settings className="h-5 w-5" />
            {!isPremiumUser && (
              <Crown className="h-3 w-3 text-amber-400 absolute top-0.5 right-0.5" />
            )}
          </button>

          {/* Auto Scroll Play/Pause Button */}
          <button
            onClick={handleToggleAutoScroll}
            className={`p-2.5 rounded-full transition-all shadow-md ${
              autoScrollEnabled
                ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                : 'bg-rose-500/80 hover:bg-rose-500 text-white'
            }`}
            title={autoScrollEnabled ? 'Pause Auto Scroll' : 'Play Auto Scroll'}
          >
            {autoScrollEnabled ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Chapter List Modal Trigger */}
          <button
            onClick={() => setShowChapterList(true)}
            className="p-2 rounded-full hover:bg-white/10 hover:text-white transition-colors"
            title="Daftar Chapter"
          >
            <List className="h-5 w-5" />
          </button>

          {/* Download Chapter ZIP */}
          <button
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            className="p-2 rounded-full hover:bg-white/10 hover:text-amber-400 transition-colors text-amber-500/90"
            title="Unduh Chapter (ZIP)"
          >
            <Download className={`h-5 w-5 ${downloadingZip ? 'animate-bounce' : ''}`} />
          </button>

          {/* Scroll to Comments */}
          <button
            onClick={scrollToComments}
            className="p-2 rounded-full hover:bg-white/10 hover:text-white transition-colors"
            title="Ke Komentar"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Next Chapter */}
          <button
            onClick={handleNextChapter}
            disabled={!hasNextChapter}
            className={`p-2 rounded-full transition-colors ${
              hasNextChapter
                ? 'hover:bg-white/10 hover:text-white text-gray-200'
                : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Next Chapter"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Right Side Navigation Buttons (Gambar 1) */}
      <div
        className={`fixed right-4 bottom-24 z-40 flex flex-col gap-2 transition-all duration-300 ${
          isControlsVisible
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 translate-x-6 pointer-events-none'
        }`}
      >
        <button
          onClick={scrollUp}
          className="p-3 bg-[#181920]/80 backdrop-blur-md border border-white/10 text-white rounded-full shadow-xl hover:bg-white/20 transition-all active:scale-95"
          title="Scroll Ke Atas"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          onClick={scrollDown}
          className="p-3 bg-[#181920]/80 backdrop-blur-md border border-white/10 text-white rounded-full shadow-xl hover:bg-white/20 transition-all active:scale-95"
          title="Scroll Ke Bawah"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Reader Settings Drawer / Sidebar (Gambar 2) */}
      {showSettingsDrawer && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-[#121319] border-l border-white/10 w-full max-w-md h-full p-6 flex flex-col overflow-y-auto shadow-2xl text-white">
            {/* Header Drawer */}
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <h2 className="text-xl font-bold tracking-tight italic">Reader Settings</h2>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Settings Options */}
            <div className="py-6 space-y-6 flex-1">
              {/* Fit To Width Toggle */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <span className="font-semibold text-sm tracking-wider uppercase">FIT TO WIDTH</span>
                <button
                  type="button"
                  onClick={() => setFitToWidth((prev) => !prev)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    fitToWidth
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-rose-900/60 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {fitToWidth ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Image Width Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold tracking-wider text-gray-300">
                  <span>IMAGE WIDTH: {fitToWidth ? 'FIT (100%)' : `${readerImageWidth}PX`}</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={1200}
                  step={50}
                  disabled={fitToWidth}
                  value={readerImageWidth}
                  onChange={(e) => setReaderImageWidth(Number(e.target.value))}
                  className="w-full accent-rose-500 bg-white/10 rounded-lg h-2 cursor-pointer disabled:opacity-40"
                />
              </div>

              {/* Auto-Scroll Speed Slider */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-semibold tracking-wider text-gray-300">
                  <span>AUTO-SCROLL SPEED: {autoScrollSpeed + 1}X</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={autoScrollSpeed}
                  onChange={(e) => setAutoScrollSpeed(Number(e.target.value))}
                  className="w-full accent-rose-500 bg-white/10 rounded-lg h-2 cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 italic">Adjust the speed of automatic scrolling</p>
              </div>

              <hr className="border-white/10 my-4" />

              {/* Keyboard Shortcuts Reference */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  KEYBOARD SHORTCUTS
                </h3>
                <div className="space-y-2 text-xs text-gray-300">
                  <div className="flex justify-between">
                    <span className="font-mono text-gray-400">↑ / ↓</span>
                    <span>Scroll</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-gray-400">← / →</span>
                    <span>Chapters</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-gray-400">Control + Space</span>
                    <span>Toggle auto-scroll</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-gray-400">Esc</span>
                    <span>Close panels</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Close Button */}
            <div className="pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSettingsDrawer(false)}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs tracking-widest uppercase rounded-xl transition-all"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal Popup */}
      {chapterSharePopupOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14151c] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Bagikan Chapter Ini</h3>
              <button
                type="button"
                onClick={() => setChapterSharePopupOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-xs text-gray-400">
              Pilih platform untuk membagikan chapter komik ini.
            </p>

            <div className="flex flex-col gap-3 text-sm">
              <button
                type="button"
                onClick={() => copyChapterShareLink('default')}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 text-white transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-700">
                  <Copy className="h-5 w-5" />
                </div>
                <span>Salin Tautan</span>
              </button>

              <WhatsappShareButton
                url={chapterShareUrl}
                title={chapterShareTitle}
                separator=" — "
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 text-white transition-colors"
                resetButtonStyle={false}
                onClick={() => setChapterSharePopupOpen(false)}
              >
                <WhatsappIcon size={36} round />
                <span>WhatsApp</span>
              </WhatsappShareButton>

              <TwitterShareButton
                url={chapterShareUrl}
                title={chapterShareTitle}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 text-white transition-colors"
                resetButtonStyle={false}
                onClick={() => setChapterSharePopupOpen(false)}
              >
                <TwitterIcon size={36} round />
                <span>X (Twitter)</span>
              </TwitterShareButton>

              <TelegramShareButton
                url={chapterShareUrl}
                title={chapterShareTitle}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 text-white transition-colors"
                resetButtonStyle={false}
                onClick={() => setChapterSharePopupOpen(false)}
              >
                <TelegramIcon size={36} round />
                <span>Telegram</span>
              </TelegramShareButton>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
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
    </div>
  );
};

export default ChapterReader;











import { useState, useEffect, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  Share2,
  ExternalLink,
  Copy,
  Smartphone,
  Heart,
} from "lucide-react";
import ProjectSection from "../components/ProjectSection";
import UpdateSection from "../components/UpdateSection";
import PopularSection from "../components/PopularSection";
import { Link } from "react-router-dom";
import {
  WhatsappShareButton,
  TelegramShareButton,
  TwitterShareButton,
  WhatsappIcon,
  TelegramIcon,
  TwitterIcon,
} from "react-share";
import { toast } from "react-toastify";
import AOS from "aos";
import "aos/dist/aos.css";
import AdBanner from "../components/AdBanner";
import { useAds } from "../hooks/useAds";
import { apiClient, getImageUrl } from "../utils/api";
import discordIcon from "../assets/discord.svg";
import LiveChatWidget from "../components/LiveChatWidget";

const BANNER_DOTS_MAX = 8;

function synopsisPlain(html) {
  if (!html || typeof html !== "string") return "";
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [bannerManga, setBannerManga] = useState([]);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [popupBannerVisible, setPopupBannerVisible] = useState(false);
  const [homePopupIntervalMinutes, setHomePopupIntervalMinutes] = useState(10);
  const [popupSettingsReady, setPopupSettingsReady] = useState(false);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://komiknesia.com";
  const shareTitle =
    "Baca komik, manga, manhwa, dan manhua Bahasa Indonesia di KomikNesia!";
  const discordInviteUrl = "https://discord.gg/dgC22PSm9h";
  const donateUrl = "https://saweria.co/KomikNesia";

  const copyShareLink = async (context = "default") => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (context === "tiktok") {
        toast.success("Link disalin. Buka TikTok dan tempel di bio, DM, atau caption.");
      } else {
        toast.success("Tautan berhasil disalin.");
      }
    } catch {
      toast.error("Gagal menyalin. Salin manual: " + shareUrl);
    }
  };

  useEffect(() => {
    fetchBannerManga();
  }, []);

  useEffect(() => {
    setCurrentSlide((prev) => {
      const n = bannerManga.length;
      if (n === 0) return 0;
      return prev < n ? prev : n - 1;
    });
  }, [bannerManga.length]);

  const fetchBannerManga = async () => {
    try {
      const items = await apiClient.getFeaturedItems("banner", true);
      const sorted = items.sort((a, b) => a.display_order - b.display_order);
      setBannerManga(sorted);
    } catch (error) {
      console.error("Error fetching banner manga:", error);
    } finally {
      setBannerLoading(false);
    }
  };

  // Fetch ads by type
  const { ads: homeTopAds } = useAds("home-top");
  const { ads: populerAds } = useAds("populer");
  const { ads: homeFooterAds } = useAds("home-footer");
  const { ads: homePopupAds } = useAds("home-popup");

  useEffect(() => {
    apiClient
      .getSettings()
      .then((s) => {
        const v = s.home_popup_interval_minutes;
        if (Number.isFinite(v) && [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].includes(v)) {
          setHomePopupIntervalMinutes(v);
        }
      })
      .catch(() => {})
      .finally(() => setPopupSettingsReady(true));
  }, []);

  useEffect(() => {
    AOS.init({
      duration: 600,
      once: true,
      easing: "ease-out-cubic",
    });
  }, []);

  // Home-only popup banner: jangan tampil sampai getSettings selesai (default 10 menit), baru pakai interval dari admin
  useEffect(() => {
    if (typeof window === "undefined" || !popupSettingsReady) return;

    try {
      const storageKey = "homePopupLastShownAt";
      const lastShownRaw = localStorage.getItem(storageKey);
      const intervalMs = homePopupIntervalMinutes * 60 * 1000;

      if (!lastShownRaw) {
        setPopupBannerVisible(true);
        return;
      }

      const lastShown = parseInt(lastShownRaw, 10);
      if (Number.isNaN(lastShown) || Date.now() - lastShown >= intervalMs) {
        setPopupBannerVisible(true);
      }
    } catch (error) {
      console.error("Error reading home popup timestamp:", error);
      setPopupBannerVisible(true);
    }
  }, [popupSettingsReady, homePopupIntervalMinutes]);

  useEffect(() => {
    if (bannerManga.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % bannerManga.length);
      }, 5000); // Auto-slide every 5 seconds

      return () => clearInterval(timer);
    }
  }, [bannerManga.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % bannerManga.length);
  };

  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + bannerManga.length) % bannerManga.length
    );
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const bannerDotIndices = useMemo(() => {
    const n = bannerManga.length;
    if (n === 0) return [];
    if (n <= BANNER_DOTS_MAX) {
      return Array.from({ length: n }, (_, i) => i);
    }
    const start = Math.min(
      Math.max(0, currentSlide - Math.floor(BANNER_DOTS_MAX / 2)),
      n - BANNER_DOTS_MAX,
    );
    return Array.from({ length: BANNER_DOTS_MAX }, (_, i) => start + i);
  }, [bannerManga.length, currentSlide]);

  /** Swipe horizontal di mobile — slide non-aktif pakai pointer-events-none agar tidak menutupi area sentuh */
  const bannerTouchRef = useRef(null);
  const onBannerTouchStart = (e) => {
    if (bannerManga.length < 2) return;
    const t = e.touches[0];
    bannerTouchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onBannerTouchEnd = (e) => {
    if (!bannerTouchRef.current || bannerManga.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - bannerTouchRef.current.x;
    const dy = t.clientY - bannerTouchRef.current.y;
    bannerTouchRef.current = null;
    const minSwipe = 52;
    if (Math.abs(dx) < minSwipe || Math.abs(dx) < Math.abs(dy) * 0.85) return;
    if (dx < 0) nextSlide();
    else prevSlide();
  };

  const handleClosePopupBanner = () => {
    setPopupBannerVisible(false);

    if (typeof window === "undefined") return;

    try {
      const storageKey = "homePopupLastShownAt";
      localStorage.setItem(storageKey, Date.now().toString());
    } catch (error) {
      console.error("Error saving home popup timestamp:", error);
    }
  };

  return (
    <div className="pt-5 md:pt-20 pb-4">
      <Helmet>
        <title>KomikNesia | Baca Komik, Manga, Manhwa, dan Manhua Bahasa Indonesia</title>
        <meta name="description" content="Baca komik, manga, manhwa, dan manhua bahasa Indonesia gratis di KomikNesia. Update terbaru, kualitas terbaik, dan mudah dibaca di semua perangkat." />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Home Top Ads - 6 ads */}
        {homeTopAds.length > 0 && (
          <div className="mb-4 md:mb-8" data-aos="fade-up">
            <AdBanner
              ads={homeTopAds}
              layout="grid"
              columns={2}
            />
          </div>
        )}

        {/* Home Popup Announcement Banner - fixed, centered, closeable */}
        {homePopupAds.length > 0 && popupBannerVisible && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative max-w-64 w-full">
              <button
                onClick={handleClosePopupBanner}
                className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-red-900 dark:bg-red-800 text-white hover:bg-gray-700 dark:hover:bg-gray-600 shadow-lg transition-colors"
                aria-label="Tutup banner"
              >
                <X className="h-5 w-5" />
              </button>
              <AdBanner
                ads={homePopupAds}
                layout="grid"
                columns={1}
              />
            </div>
          </div>
        )}
      </div>
      {/* Hero Section with Dark Background */}
   

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Featured Slider - Popular Daily */}
        <div
          className="mb-12 relative"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          <div
            className="relative h-[500px] md:h-[500px] rounded-2xl overflow-hidden touch-pan-y"
            onTouchStart={onBannerTouchStart}
            onTouchEnd={onBannerTouchEnd}
          >
            {bannerLoading ? (
              <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse">
                <div className="h-full w-full bg-gray-300 dark:bg-gray-700 md:hidden" />
                <div className="hidden h-full w-full md:flex md:flex-row">
                  <div className="w-full md:w-1/2 h-full p-8 flex flex-col justify-end md:justify-center space-y-4">
                    <div className="h-8 md:h-12 w-3/4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    <div className="flex gap-3">
                      <div className="h-6 w-24 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                      <div className="h-6 w-20 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-gray-300 dark:bg-gray-700 rounded"></div>
                      <div className="h-4 w-5/6 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    </div>
                    <div className="hidden md:block h-10 w-40 bg-gray-300 dark:bg-gray-700 rounded-lg mt-2"></div>
                  </div>
                  <div className="hidden md:block w-1/2 h-full p-8">
                    <div className="h-full w-64 max-w-full mx-auto bg-gray-300 dark:bg-gray-700 rounded-2xl"></div>
                  </div>
                </div>
              </div>
            ) : bannerManga.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <p className="text-gray-500 dark:text-gray-400">
                  Tidak ada banner tersedia
                </p>
              </div>
            ) : (
              bannerManga.map((item, index) => {
                const latest = item.lastChapters?.[0];
                const readHref = latest?.slug
                  ? `/view/${latest.slug}`
                  : `/komik/${item.slug}`;
                const synopsis = synopsisPlain(item.synopsis);
                const genres = Array.isArray(item.genres) ? item.genres : [];

                return (
              <div
                key={item.id || index}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                  index === currentSlide
                    ? "z-[2] opacity-100 translate-x-0 pointer-events-auto"
                    : "z-0 opacity-0 translate-x-full pointer-events-none"
                }`}
              >
                {/* Mobile: gambar full height + judul & CTA overlay (tanpa panel hitam bawah) */}
                <div className="absolute inset-0 md:hidden">
                  <img
                    src={getImageUrl(item.cover)}
                    alt={item.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div
                    className="absolute -bottom-24 inset-0 bg-gradient-to-t from-black via-black/10 to-transparent"
                    aria-hidden
                  />
                  <div className="relative z-[1] flex h-full flex-col justify-end px-4 pb-6 pt-20 text-center">
                    <Link to={`/komik/${item.slug}`}>
                      <h2 className="text-lg font-bold leading-snug text-white drop-shadow-md line-clamp-2 transition-colors hover:text-amber-100">
                        {item.title}
                      </h2>
                    </Link>
                    <div className="mt-3 flex justify-center pb-1">
                      <Link
                        to={readHref}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-gray-900 shadow-md transition-colors hover:bg-amber-300"
                      >
                        Mulai Baca
                        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Desktop: blurred cover + dark overlay */}
                <div className="hidden md:block absolute inset-0 overflow-hidden">
                  <img
                    src={getImageUrl(item.cover)}
                    alt=""
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl"
                    aria-hidden
                  />
                  <div className="absolute inset-0 bg-black/75" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-transparent" />
                </div>

                {/* Desktop: judul, sinopsis, genre, CTA + cover */}
                <div className="relative hidden h-full md:flex md:items-center">
                  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 md:pb-0">
                    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
                      <div className="z-[1] space-y-4 text-center text-white md:space-y-6 md:text-left">
                        {latest?.number != null && (
                          <p className="text-sm font-bold uppercase tracking-wide text-white/90 md:text-base">
                            Chapter: {latest.number}
                          </p>
                        )}
                        <Link to={`/komik/${item.slug}`}>
                          <h2 className="text-2xl font-bold leading-tight line-clamp-2 cursor-pointer transition-colors hover:text-white/90 md:text-4xl lg:text-5xl">
                            {item.title}
                          </h2>
                        </Link>

                        {synopsis ? (
                          <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/85 line-clamp-3 md:mx-0 md:text-base md:line-clamp-4">
                            {synopsis}
                          </p>
                        ) : (
                          <p className="mx-auto max-w-xl text-sm text-white/70 md:mx-0 md:text-base">
                            {item.author ? `Oleh ${item.author}` : "\u00a0"}
                          </p>
                        )}

                        {genres.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                            {genres.slice(0, 8).map((g) => (
                              <span
                                key={g.id ?? g.slug ?? g.name}
                                className="rounded-full border border-white/50 bg-white/5 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm md:text-sm"
                              >
                                {g.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-center gap-4 pt-1 md:justify-start">
                          <Link
                            to={readHref}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-8 py-3.5 text-base font-bold text-gray-900 shadow-lg transition-all hover:bg-amber-300 hover:shadow-xl"
                          >
                            Mulai Baca
                            <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
                          </Link>
                          {item.total_views != null && (
                            <span className="text-sm text-white/70">
                              <span className="font-semibold text-white/90">
                                {Number(item.total_views).toLocaleString()}
                              </span>{" "}
                              tayangan
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative z-[1] flex justify-center lg:justify-end">
                        <Link
                          to={`/komik/${item.slug}`}
                          className="group relative block"
                          aria-label={item.title}
                        >
                          <div className="absolute -inset-3 rounded-3xl bg-white/10 blur-2xl transition-opacity group-hover:opacity-90" />
                          <img
                            src={getImageUrl(item.cover)}
                            alt={item.title}
                            className="relative h-[22rem] w-[14rem] rounded-xl object-cover shadow-2xl ring-1 ring-white/10 transition-transform duration-300 sm:h-[24rem] sm:w-[15rem] md:h-[26rem] md:w-64 md:-rotate-[4deg] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] group-hover:md:-rotate-[2deg]"
                          />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                );
              })
            )}

            {/* Navigation Arrows - Hidden on Mobile */}
            <button
              onClick={prevSlide}
              className="hidden md:flex absolute left-4 top-1/2 z-20 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-3 rounded-full transition-all"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              onClick={nextSlide}
              className="hidden md:flex absolute right-4 top-1/2 z-20 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-3 rounded-full transition-all"
              aria-label="Next slide"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Dots di luar kartu banner (bawah rounded) — tidak menimpa judul/CTA */}
          {!bannerLoading && bannerManga.length > 1 && (
            <div
              className="mt-4 flex justify-center gap-2.5"
              role="tablist"
              aria-label="Pilih slide banner"
            >
              {bannerDotIndices.map((slideIdx) => (
                <button
                  key={slideIdx}
                  type="button"
                  onClick={() => goToSlide(slideIdx)}
                  className={`transition-all rounded-full ${
                    slideIdx === currentSlide
                      ? "h-3 w-8 bg-sky-600 dark:bg-white"
                      : "h-3 w-3 bg-slate-400/90 hover:bg-slate-500 dark:bg-white/45 dark:hover:bg-white/70"
                  }`}
                  aria-label={`Ke slide ${slideIdx + 1}`}
                  aria-current={slideIdx === currentSlide ? "true" : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="mx-auto mb-8 grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2 md:gap-4"
          data-aos="fade-up"
          data-aos-delay="120"
        >
          <button
            type="button"
            onClick={() => setSharePopupOpen(true)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-slate-700/90 bg-[#111827] p-4 text-left shadow-md transition-all hover:border-slate-600 hover:bg-slate-800/95 md:p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-inner md:h-14 md:w-14">
              <Share2 className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-white md:text-lg">Bagikan KomikNesia</p>
              <p className="text-sm text-slate-400">
                Salin tautan, WhatsApp, X, TikTok, Telegram
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" aria-hidden />
          </button>

          <a
            href={discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-full items-center gap-4 rounded-2xl border border-slate-700/90 bg-[#111827] p-4 text-left shadow-md transition-all hover:border-slate-600 hover:bg-slate-800/95 md:p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#5865F2] text-white shadow-inner md:h-14 md:w-14">
              <img src={discordIcon} alt="" className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-white md:text-lg">Discord</p>
              <p className="text-sm text-slate-400">Gabung komunitas pembaca</p>
            </div>
            <ExternalLink className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-slate-300" aria-hidden />
          </a>

          <a
            href={donateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-full items-center gap-4 rounded-2xl border border-slate-700/90 bg-[#111827] p-4 text-left shadow-md transition-all hover:border-slate-600 hover:bg-slate-800/95 md:p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-inner md:h-14 md:w-14">
              <Heart className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-white md:text-lg">Donasi</p>
              <p className="text-sm text-slate-400">Dukung lewat Saweria</p>
            </div>
            <ExternalLink className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-slate-300" aria-hidden />
          </a>

          <button
            type="button"
            onClick={() => setInstallModalOpen(true)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-slate-700/90 bg-[#111827] p-4 text-left shadow-md transition-all hover:border-slate-600 hover:bg-slate-800/95 md:p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-inner md:h-14 md:w-14">
              <Smartphone className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-white md:text-lg">Unduh aplikasi</p>
              <p className="text-sm text-slate-400">Pasang ke layar utama (PWA)</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" aria-hidden />
          </button>
        </div>

        {sharePopupOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Bagikan KomikNesia"
          >
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 text-left shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Bagikan KomikNesia</h3>
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
                Pilih cara membagikan tautan situs ke teman atau medsos kamu.
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    copyShareLink("default");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-600">
                    <Copy className="h-5 w-5" aria-hidden />
                  </span>
                  <span>Salin tautan</span>
                </button>

                <WhatsappShareButton
                  url={shareUrl}
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
                  url={shareUrl}
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
                  onClick={() => copyShareLink("tiktok")}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-lg font-bold tracking-tight text-white ring-1 ring-white/20" aria-hidden>
                    TT
                  </span>
                  <span className="flex flex-col">
                    <span>TikTok</span>
                    <span className="text-xs font-normal text-slate-400">Salin tautan untuk dibagikan di TikTok</span>
                  </span>
                </button>

                <TelegramShareButton
                  url={shareUrl}
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

        {installModalOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Cara memasang aplikasi"
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 text-left shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Cara memasang aplikasi</h3>
                <button
                  type="button"
                  onClick={() => setInstallModalOpen(false)}
                  className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mb-4 text-sm leading-relaxed text-slate-300">
                Ikuti langkah berikut untuk memasang aplikasi web KomikNesia di perangkat kamu (tampilan seperti aplikasi):
              </p>

              <ol className="mb-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-200">
                <li>Ketuk ikon menu (titik tiga) di pojok browser.</li>
                <li>
                  Pilih <strong className="text-white">Pasang aplikasi</strong> atau{" "}
                  <strong className="text-white">Tambahkan ke Layar utama</strong> (nama menu bisa sedikit berbeda
                  tergantung browser).
                </li>
                <li>Ikuti petunjuk di layar hingga pemasangan selesai.</li>
              </ol>

              <button
                type="button"
                onClick={() => setInstallModalOpen(false)}
                className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* Project (is_project) — hidden when empty */}
        <div data-aos="fade-up" data-aos-delay="175">
          <ProjectSection />
        </div>

        {/* Update Section */}
        <div data-aos="fade-up" data-aos-delay="200">
          <UpdateSection />
        </div>

        {/* Populer Ads - 4 ads above Popular Section */}
        {populerAds.length > 0 && (
          <div className="mb-8" data-aos="fade-up" data-aos-delay="250">
            <AdBanner
              ads={populerAds}
              layout="grid"
              columns={2}
            />
          </div>
        )}

        {/* Popular Section */}
        <div data-aos="fade-up" data-aos-delay="300">
          <PopularSection />
        </div>

        {/* Home Footer Ads - 2 ads at bottom */}
        {homeFooterAds.length > 0 && (
          <div className="mt-8" data-aos="fade-up" data-aos-delay="350">
            <AdBanner
              ads={homeFooterAds}
              layout="grid"
              columns={2}
              className="mb-6"
            />
          </div>
        )}
      </div>

      <LiveChatWidget />
    </div>
  );
};

export default Home;

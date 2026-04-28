import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  Share2,
  Coffee,
  ExternalLink,
} from "lucide-react";
import UpdateSection from "../components/UpdateSection";
import PopularSection from "../components/PopularSection";
import { Link } from "react-router-dom";
import {
  WhatsappShareButton,
  FacebookShareButton,
  TelegramShareButton,
  TwitterShareButton,
  WhatsappIcon,
  FacebookIcon,
  TelegramIcon,
  TwitterIcon,
} from "react-share";
import AOS from "aos";
import "aos/dist/aos.css";
import AdBanner from "../components/AdBanner";
import { useAds } from "../hooks/useAds";
import { apiClient, getImageUrl } from "../utils/api";
import LiveChatWidget from "../components/LiveChatWidget";
import discordIcon from "../assets/discord.svg";

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [bannerManga, setBannerManga] = useState([]);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [popupBannerVisible, setPopupBannerVisible] = useState(false);
  const [homePopupIntervalMinutes, setHomePopupIntervalMinutes] = useState(10);
  const [popupSettingsReady, setPopupSettingsReady] = useState(false);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://komiknesia.com";
  const shareTitle = "Baca komik, manga, manhwa, dan manhua Bahasa Indonesia di KomikNesia!";
  const discordInviteUrl = "https://discord.gg/dgC22PSm9h";
  const donateUrl = "https://saweria.co/KomikNesia";

  useEffect(() => {
    fetchBannerManga();
  }, []);

  const fetchBannerManga = async () => {
    try {
      const items = await apiClient.getFeaturedItems("banner", true);
      // Sort by display_order and limit to 5
      const sorted = items
        .sort((a, b) => a.display_order - b.display_order)
        .slice(0, 5);
      setBannerManga(sorted);
    } catch (error) {
      console.error("Error fetching banner manga:", error);
    } finally {
      setBannerLoading(false);
    }
  };

  // Fetch ads by type
  const { ads: homeTopAds } = useAds("home-top", 10);
  const { ads: newUpdateAds } = useAds("new-update", 10);
  const { ads: populerAds } = useAds("populer", 10);
  const { ads: homeFooterAds } = useAds("home-footer", 10);
  // Home-only popup/banner announcement (single image)
  const { ads: homePopupAds } = useAds("home-popup", 1);

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
          className="mb-12 relative overflow-hidden"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          <div className="relative h-[500px] md:h-[500px] rounded-2xl overflow-hidden">
            {bannerLoading ? (
              <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse">
                <div className="h-full w-full flex flex-col md:flex-row">
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
              bannerManga.map((item, index) => (
              <div
                key={item.id || index}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                  index === currentSlide
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 translate-x-full"
                }`}
              >
                {/* Mobile: Full Cover Background */}
                <div className="md:hidden absolute inset-0">
                  <img
                    src={getImageUrl(item.cover)}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Dark Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                </div>

                {/* Desktop: Gradient Background */}
                <div
                  className="hidden md:block absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, 
                    ${
                      item.color
                        ? "rgba(99, 102, 241, 0.95)"
                        : "rgba(15, 23, 42, 0.95)"
                    } 0%, 
                    ${
                      item.color
                        ? "rgba(139, 92, 246, 0.95)"
                        : "rgba(30, 41, 59, 0.95)"
                    } 50%,
                    ${
                      item.color
                        ? "rgba(168, 85, 247, 0.95)"
                        : "rgba(51, 65, 85, 0.95)"
                    } 100%)`,
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `url(${getImageUrl(item.cover)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      filter: "blur(20px)",
                      transform: "scale(1.1)",
                    }}
                  ></div>
                </div>

                {/* Content Container */}
                <div className="relative h-full flex items-end md:items-center">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-16 md:pb-0">
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                      {/* Content */}
                      <div className="text-white space-y-3 md:space-y-6">
                        <Link to={`/komik/${item.slug}`}>
                          <h2 className="text-2xl md:text-5xl font-bold leading-tight line-clamp-2 cursor-pointer hover:text-gray-200 transition-colors">
                            {item.title}
                          </h2>
                        </Link>

                        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                          <div className="flex items-center bg-white/20 backdrop-blur-sm px-2.5 py-1 md:px-3 md:py-1.5 rounded-full">
                            <Star className="h-4 w-4 md:h-5 md:w-5 fill-yellow-400 text-yellow-400 mr-1" />
                            <span className="font-bold text-base md:text-lg">
                              {item.rating || "N/A"}
                            </span>
                          </div>

                          {item.hot && (
                            <span className="bg-red-500 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-semibold">
                              Romance
                            </span>
                          )}

                          <span className="bg-white/20 backdrop-blur-sm px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm capitalize">
                            {item.status}
                          </span>
                        </div>

                        <p className="text-white/90 text-sm md:text-lg line-clamp-2 md:line-clamp-3 max-w-xl">
                          {item.title.split(" ").slice(0, 15).join(" ")}...
                        </p>

                        <div className="hidden md:flex items-center gap-4">
                          <Link
                            to={`/komik/${item.slug}`}
                            className="bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center"
                          >
                            Baca Sekarang
                          </Link>
                          <div className="text-white/80 text-sm">
                            <span className="font-semibold">
                              {item.total_views?.toLocaleString()}
                            </span>{" "}
                            views
                          </div>
                        </div>
                      </div>

                      {/* Cover Image - Desktop Only */}
                      <div className="hidden md:flex justify-center items-center">
                        <div className="relative group">
                          <div className="absolute -inset-2 bg-white/20 rounded-2xl blur-xl group-hover:bg-white/30 transition-all"></div>
                          <img
                            src={getImageUrl(item.cover)}
                            alt={item.title}
                            className="relative rounded-xl shadow-2xl w-64 h-96 object-cover transform group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              ))
            )}

            {/* Navigation Arrows - Hidden on Mobile */}
            <button
              onClick={prevSlide}
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              onClick={nextSlide}
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-3 rounded-full transition-all z-10"
              aria-label="Next slide"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* Dots Indicator */}
            <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {bannerManga.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`transition-all rounded-full ${
                    index === currentSlide
                      ? "bg-white w-8 h-3"
                      : "bg-white/50 w-3 h-3 hover:bg-white/75"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div
          className="mb-8 grid gap-3 md:grid-cols-3 md:gap-4"
          data-aos="fade-up"
          data-aos-delay="120"
        >
          <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Share Komiknesia</p>
                <p className="text-xs text-slate-400">to your friends</p>
              </div>
              <div className="rounded-xl bg-white/10 p-2 text-cyan-300">
                <Share2 className="h-4 w-4" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSharePopupOpen(true)}
              className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              <span className="inline-flex items-center gap-1.5">
                <Share2 className="h-4 w-4" />
                Share now
              </span>
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Discord</p>
                <p className="text-xs text-slate-400">Join Discord</p>
              </div>
              <div className="rounded-xl bg-white/10 p-2">
                <img src={discordIcon} alt="Discord" className="h-4 w-4" />
              </div>
            </div>
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
            >
              <img src={discordIcon} alt="" aria-hidden="true" className="h-4 w-4" />
              Discord
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Kasih Kopi</p>
                <p className="text-xs text-slate-400">Supportnya kawan</p>
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

        {sharePopupOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Pilih platform untuk share"
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-4 text-left shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Share Komiknesia</h3>
                <button
                  type="button"
                  onClick={() => setSharePopupOpen(false)}
                  className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Tutup popup share"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mb-4 text-sm text-slate-400">Pilih mau share ke platform mana:</p>

              <div className="grid grid-cols-2 gap-3">
                <WhatsappShareButton
                  url={shareUrl}
                  title={shareTitle}
                  separator=" - "
                  className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-left text-sm text-white transition-colors hover:bg-white/10"
                  resetButtonStyle={false}
                  onClick={() => setSharePopupOpen(false)}
                >
                  <WhatsappIcon size={32} round />
                  <span>WhatsApp</span>
                </WhatsappShareButton>

                <FacebookShareButton
                  url={shareUrl}
                  hashtag="#KomikNesia"
                  className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-left text-sm text-white transition-colors hover:bg-white/10"
                  resetButtonStyle={false}
                  onClick={() => setSharePopupOpen(false)}
                >
                  <FacebookIcon size={32} round />
                  <span>Facebook</span>
                </FacebookShareButton>

                <TelegramShareButton
                  url={shareUrl}
                  title={shareTitle}
                  className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-left text-sm text-white transition-colors hover:bg-white/10"
                  resetButtonStyle={false}
                  onClick={() => setSharePopupOpen(false)}
                >
                  <TelegramIcon size={32} round />
                  <span>Telegram</span>
                </TelegramShareButton>

                <TwitterShareButton
                  url={shareUrl}
                  title={shareTitle}
                  className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-left text-sm text-white transition-colors hover:bg-white/10"
                  resetButtonStyle={false}
                  onClick={() => setSharePopupOpen(false)}
                >
                  <TwitterIcon size={32} round />
                  <span>X / Twitter</span>
                </TwitterShareButton>
              </div>
            </div>
          </div>
        )}

        {/* New Update Ads - 4 ads above Update Section */}
        {newUpdateAds.length > 0 && (
          <div className="mb-8" data-aos="fade-up" data-aos-delay="150">
            <AdBanner
              ads={newUpdateAds}
              layout="grid"
              columns={2}
            />
          </div>
        )}

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

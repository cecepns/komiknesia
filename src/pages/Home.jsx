import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import {
  X,
  Share2,
  ExternalLink,
  Copy,
  Smartphone,
  Heart,
  Crown,
  ChevronRight,
} from "lucide-react";
import ProjectSection from "../components/ProjectSection";
import UpdateSection from "../components/UpdateSection";
import PopularSection from "../components/PopularSection";
import ComicTypeSection from "../components/ComicTypeSection";
import HeroBannerSection from "../components/HeroBannerSection";
import FeaturedBanner from "../components/FeaturedBanner";
import "../styles/featured-banner.css";
import { Link, useNavigate } from "react-router-dom";
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
import { apiClient } from "../utils/api";
import discordIcon from "../assets/discord.svg";
import LiveChatWidget from "../components/LiveChatWidget";
import LoginModal from "../components/LoginModal";
import { useChapterAccess } from "../hooks/useChapterAccess";

const Home = () => {
  const navigate = useNavigate();
  const { loginOpen, openChapter, handleLoginSuccess, closeLogin } = useChapterAccess();
  const [bannerManga, setBannerManga] = useState([]);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [popupBannerVisible, setPopupBannerVisible] = useState(false);
  const [homePopupIntervalMinutes, setHomePopupIntervalMinutes] = useState(10);
  const [popupSettingsReady, setPopupSettingsReady] = useState(false);
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://komiknesia.com";
  const shareTitle =
    "Baca komik, manga, manhwa, dan manhua Bahasa Indonesia di KomikNesia!";
  const discordInviteUrl = "https://discord.gg/dgC22PSm9h";
  const donateUrl = "https://saweria.co/KomikNesia";

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          toast.success("Terima kasih telah memasang aplikasi KomikNesia!");
          setDeferredPrompt(null);
          return;
        }
      } catch (err) {
        console.error("Error triggering PWA prompt:", err);
      }
    }
    toast.info("Silakan gunakan menu browser (titik 3) -> 'Tambahkan ke Layar Utama' / 'Pasang Aplikasi'", {
      autoClose: 5000,
    });
  };

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

  const [heroBanners, setHeroBanners] = useState([]);

  useEffect(() => {
    fetchBannerManga();
  }, []);

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

  useEffect(() => {
    apiClient.getSettings().then((s) => {
      if (s && Array.isArray(s.hero_banners) && s.hero_banners.length > 0) {
        setHeroBanners(s.hero_banners);
      }
    }).catch(() => {});
  }, []);

  // Fetch ads by type
  const { ads: homeTopAds } = useAds("home-top");
  const { ads: populerAds } = useAds("populer");
  const { ads: homeFooterAds } = useAds("home-footer");
  const { ads: homePopupAds } = useAds("home-popup");

  const [quickLinks, setQuickLinks] = useState([
    { id: 'discord', title: 'Discord', href: 'https://discord.gg/dgC22PSm9h', icon: 'Discord', is_active: true },
    { id: 'facebook', title: 'Facebook', href: 'https://facebook.com', icon: 'Facebook', is_active: true },
    { id: 'instagram', title: 'Instagram', href: 'https://instagram.com', icon: 'Instagram', is_active: true },
    { id: 'download_app', title: 'Download App', href: 'https://02.komiknesia.asia/', icon: 'Download', is_active: true }
  ]);

  useEffect(() => {
    apiClient
      .getSettings()
      .then((s) => {
        const v = s.home_popup_interval_minutes;
        if (Number.isFinite(v) && [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].includes(v)) {
          setHomePopupIntervalMinutes(v);
        }
        if (s && Array.isArray(s.quick_links) && s.quick_links.length > 0) {
          const webAppLinks = s.quick_links.filter(item => item.is_active !== false && item.is_web_app !== false);
          if (webAppLinks.length > 0) setQuickLinks(webAppLinks);
        }
      })
      .catch(() => {})
      .finally(() => setPopupSettingsReady(true));
  }, []);

  const renderHomeIcon = (iconName) => {
    if (iconName === 'Discord') {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]">
          <img src={discordIcon} alt="" className="h-3.5 w-3.5" aria-hidden />
        </div>
      );
    }
    if (iconName === 'Facebook') {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1877F2] text-white">
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>
      );
    }
    if (iconName === 'TikTok') {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-white border border-gray-700">
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68 6.34 6.34 0 0 0 9.33 22a6.34 6.34 0 0 0 6.34-6.34V9.37a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.85-.8z"/>
          </svg>
        </div>
      );
    }
    if (iconName === 'Instagram') {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white">
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </div>
      );
    }
    if (iconName === 'Crown') {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
          <Crown className="h-3.5 w-3.5" />
        </div>
      );
    }
    if (iconName === 'Download' || iconName === 'Smartphone') {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Smartphone className="h-3.5 w-3.5" />
        </div>
      );
    }
    if (iconName === 'Heart') {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white">
          <Heart className="h-3.5 w-3.5" />
        </div>
      );
    }

    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white">
        <ExternalLink className="h-3.5 w-3.5" />
      </div>
    );
  };

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

  const handleReadLatest = (latest, mangaSlug) => {
    if (latest?.slug) {
      openChapter(navigate, latest, true);
      return;
    }
    if (mangaSlug) navigate(`/komik/${mangaSlug}`);
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
        {/* Hero Slider Banner */}
        <div
          className="mb-12"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          <HeroBannerSection banners={heroBanners && heroBanners.length > 0 ? heroBanners : bannerManga} />
        </div>

        {/* Simple Link Badges Section per Client Feedback */}
        <div
          className="mx-auto mb-8 grid grid-cols-2 gap-2 max-w-3xl sm:grid-cols-3 md:flex md:flex-wrap md:items-center md:justify-center md:gap-3"
          data-aos="fade-up"
          data-aos-delay="120"
        >
          {quickLinks.map((item) => {
            const isDownloadApp = item.id === 'download_app' || item.icon === 'Download' || item.icon === 'Smartphone' || item.title.toLowerCase().includes('download');

            const btnCls = "inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/90 backdrop-blur-md px-2 py-1.5 shadow-md transition-all hover:scale-105 hover:border-white/20 hover:bg-white/10 md:px-2.5 md:py-1.5";
            const txtCls = "text-[11px] font-semibold text-white sm:text-xs truncate";
            const iconCls = "";

            if (isDownloadApp) {
              return (
                <button
                  key={item.id || item.title}
                  type="button"
                  onClick={handleInstallClick}
                  className={`${btnCls} ${iconCls}`}
                >
                  {renderHomeIcon(item.icon)}
                  <span className={txtCls}>
                    {item.title}
                  </span>
                </button>
              );
            }

            if (item.is_internal) {
              return (
                <Link
                  key={item.id || item.title}
                  to={item.href}
                  className={`${btnCls} ${iconCls}`}
                >
                  {renderHomeIcon(item.icon)}
                  <span className={txtCls}>
                    {item.title}
                  </span>
                </Link>
              );
            }

            return (
              <a
                key={item.id || item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnCls} ${iconCls}`}
              >
                {renderHomeIcon(item.icon)}
                <span className={txtCls}>
                  {item.title}
                </span>
              </a>
            );
          })}
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

        {/* 1. Populer Section */}
        {populerAds.length > 0 && (
          <div className="mb-8" data-aos="fade-up" data-aos-delay="150">
            <AdBanner
              ads={populerAds}
              layout="grid"
              columns={2}
            />
          </div>
        )}
        <div data-aos="fade-up" data-aos-delay="175">
          <PopularSection />
        </div>

        {/* 2. Projek Section */}
        <div data-aos="fade-up" data-aos-delay="200">
          <ProjectSection />
        </div>

        {/* 3. Last Update Section */}
        <div data-aos="fade-up" data-aos-delay="225">
          <UpdateSection />
        </div>

        {/* 4. Manhwa Section */}
        <div data-aos="fade-up" data-aos-delay="250">
          <ComicTypeSection
            title="MANHWA"
            type="manhwa"
            targetUrl="/content?type=Manhwa"
          />
        </div>

        {/* 5. Manga Section */}
        <div data-aos="fade-up" data-aos-delay="275">
          <ComicTypeSection
            title="MANGA"
            type="manga"
            targetUrl="/content?type=Manga"
          />
        </div>

        {/* 6. Manhua Section */}
        <div data-aos="fade-up" data-aos-delay="300">
          <ComicTypeSection
            title="MANHUA"
            type="manhua"
            targetUrl="/content?type=Manhua"
          />
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

      <LoginModal
        open={loginOpen}
        onClose={closeLogin}
        onSuccess={() => handleLoginSuccess(navigate)}
      />
    </div>
  );
};

export default Home;

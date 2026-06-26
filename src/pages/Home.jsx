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
        {/* Featured Slider */}
        <div
          className="mb-12"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          <FeaturedBanner
            items={bannerManga}
            loading={bannerLoading}
            onReadLatest={handleReadLatest}
          />
        </div>

        <div
          className="mx-auto mb-8 grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2 md:gap-4"
          data-aos="fade-up"
          data-aos-delay="120"
        >
          <Link
            to="/premium"
            className="group flex w-full items-center gap-4 rounded-2xl border border-amber-500/30 bg-[#111827] p-4 text-left shadow-md transition-all hover:border-amber-400/50 hover:bg-slate-800/95 md:p-5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-inner md:h-14 md:w-14">
              <Crown className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-white md:text-lg">Premium</p>
              <p className="text-sm text-slate-400">
                Tanpa iklan, bonus point, dan fitur eksklusif
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-300" aria-hidden />
          </Link>

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

      <LoginModal
        open={loginOpen}
        onClose={closeLogin}
        onSuccess={() => handleLoginSuccess(navigate)}
      />
    </div>
  );
};

export default Home;

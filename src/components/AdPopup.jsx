import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { getImageUrl, apiClient } from '../utils/api';
import LazyImage from './LazyImage';
import { useAds } from '../hooks/useAds';

const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const POPUP_INITIAL_DELAY_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30];
const POPUP_UNLOCK_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const DEFAULT_INITIAL_DELAY_MINUTES = 5;
const DEFAULT_UNLOCK_SECONDS = 10;
const STORAGE_KEY = 'adPopupStateV2';

const sanitizeRedirectUrls = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((url) => /^https?:\/\//i.test(url));
};

/**
 * AdPopup component to display popup ads.
 * - Background hitam dengan hiasan bintang-bintang warna merah.
 * - Bar kontrol: Kiri = Angka countdown (abu-abu), Tengah = Skip Iklan (merah), Kanan = Beli Premium (emas).
 */
const AdPopup = () => {
  const navigate = useNavigate();
  const { ads, loading } = useAds('popup');
  const [isOpen, setIsOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [countdown, setCountdown] = useState(DEFAULT_UNLOCK_SECONDS);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(10);
  const [initialDelayMinutes, setInitialDelayMinutes] = useState(DEFAULT_INITIAL_DELAY_MINUTES);
  const [unlockSeconds, setUnlockSeconds] = useState(DEFAULT_UNLOCK_SECONDS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [redirectScriptUrls, setRedirectScriptUrls] = useState([]);
  const [pendingPremiumRedirect, setPendingPremiumRedirect] = useState(false);
  const isOpenRef = useRef(false);
  const fallbackTimingStateRef = useRef(null);

  useEffect(() => {
    apiClient
      .getSettings()
      .then((s) => {
        const interval = s.popup_ads_interval_minutes;
        if (Number.isFinite(interval) && POPUP_INTERVAL_OPTIONS.includes(interval)) {
          setSlotIntervalMinutes(interval);
        }
        const initialDelay = s.popup_ads_initial_delay_minutes;
        if (Number.isFinite(initialDelay) && POPUP_INITIAL_DELAY_OPTIONS.includes(initialDelay)) {
          setInitialDelayMinutes(initialDelay);
        }
        const unlock = s.popup_ads_unlock_seconds;
        if (Number.isFinite(unlock) && POPUP_UNLOCK_SECONDS_OPTIONS.includes(unlock)) {
          setUnlockSeconds(unlock);
        }
        setRedirectScriptUrls(sanitizeRedirectUrls(s?.redirect_script_urls));
      })
      .catch(() => {})
      .finally(() => setSettingsReady(true));
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const readTimingState = () => {
    if (typeof window === 'undefined') return null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallbackTimingStateRef.current;
      return JSON.parse(raw);
    } catch {
      return fallbackTimingStateRef.current;
    }
  };

  const writeTimingState = (state) => {
    fallbackTimingStateRef.current = state;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage write failures
    }
  };

  useEffect(() => {
    if (!settingsReady || !ads.length || loading) return;

    const UNLOCK_MS = unlockSeconds * 1000;
    const INITIAL_DELAY_MS = initialDelayMinutes * 60 * 1000;

    const checkAndHandleSchedule = () => {
      if (typeof window === 'undefined') return;

      try {
        const now = Date.now();
        const intervalMs = slotIntervalMinutes * 60 * 1000;
        let state = readTimingState();

        if (!state || !Number.isFinite(state.startedAt)) {
          state = {
            startedAt: now,
            lastShownCycle: -1,
          };
          writeTimingState(state);
        }

        const firstPopupAt = state.startedAt + INITIAL_DELAY_MS;
        if (now < firstPopupAt) {
          if (isOpenRef.current) setIsOpen(false);
          setCanClose(false);
          setCountdown(unlockSeconds);
          return;
        }

        const cycleIndex = Math.floor((now - firstPopupAt) / intervalMs);
        const cycleStartedAt = firstPopupAt + cycleIndex * intervalMs;
        const elapsedMs = now - cycleStartedAt;

        if (state.skippedCycle === cycleIndex) {
          if (isOpenRef.current) setIsOpen(false);
          setCanClose(true);
          setCountdown(0);
          return;
        }

        if (state.lastShownCycle !== cycleIndex) {
          state.lastShownCycle = cycleIndex;
          writeTimingState(state);
          if (elapsedMs < UNLOCK_MS) {
            const remainingSeconds = Math.max(
              0,
              unlockSeconds - Math.floor(elapsedMs / 1000)
            );
            setIsOpen(true);
            setCanClose(false);
            setCountdown(remainingSeconds);
          } else {
            if (isOpenRef.current) setIsOpen(false);
            setCanClose(false);
            setCountdown(unlockSeconds);
          }
          return;
        }

        if (elapsedMs >= UNLOCK_MS) {
          if (isOpenRef.current) setIsOpen(false);
          setCanClose(true);
          setCountdown(0);
          return;
        }

        const remainingSeconds = Math.max(
          0,
          unlockSeconds - Math.floor(elapsedMs / 1000)
        );

        setIsOpen(true);
        setCanClose(remainingSeconds === 0);
        setCountdown(remainingSeconds);
      } catch (error) {
        console.error('Error handling ad popup slot timing:', error);
        if (!isOpenRef.current) {
          setIsOpen(true);
          setCanClose(false);
          setCountdown(unlockSeconds);
        }
      }
    };

    checkAndHandleSchedule();

    const interval = setInterval(() => {
      checkAndHandleSchedule();
    }, 1000);

    return () => clearInterval(interval);
  }, [settingsReady, ads.length, loading, slotIntervalMinutes, initialDelayMinutes, unlockSeconds]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!pendingPremiumRedirect || !canClose) return;

    setPendingPremiumRedirect(false);
    setIsOpen(false);
    navigate('/premium');
  }, [pendingPremiumRedirect, canClose, navigate]);

  const handlePremiumClick = () => {
    setIsOpen(false);
    navigate('/premium');
  };

  const handleSkipAd = () => {
    const urls = redirectScriptUrls.length
      ? redirectScriptUrls
      : sanitizeRedirectUrls(['https://mbuh.my.id/siap/1770790072377-komiknesia.js']);
    if (!urls.length) return;

    const randomUrl = urls[Math.floor(Math.random() * urls.length)];

    try {
      const now = Date.now();
      const intervalMs = slotIntervalMinutes * 60 * 1000;
      const initialDelayMs = initialDelayMinutes * 60 * 1000;
      let state = readTimingState();

      if (!state || !Number.isFinite(state.startedAt)) {
        state = { startedAt: now, lastShownCycle: -1 };
      }

      const firstPopupAt = state.startedAt + initialDelayMs;
      const cycleIndex = Math.max(0, Math.floor((now - firstPopupAt) / intervalMs));

      writeTimingState({
        ...state,
        skippedCycle: cycleIndex,
        lastShownCycle: cycleIndex,
      });
    } catch {
      // ignore storage failures
    }

    setIsOpen(false);
    window.location.href = randomUrl;
  };

  const handleAdClick = (ad) => {
    if (ad.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen || !ads.length) {
    return null;
  }

  const displayAds = ads;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col w-full h-full bg-black overflow-hidden select-none">
      {/* Background Ornamen Bintang Merah */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute inset-0 bg-black" />
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              top: `${(i * 19) % 100}%`,
              left: `${(i * 29 + (i % 7) * 13) % 100}%`,
              opacity: 0.35 + (i % 5) * 0.12,
              animationDuration: `${1.8 + (i % 5) * 0.6}s`,
              animationDelay: `${(i % 4) * 0.4}s`,
            }}
          >
            <svg
              width={8 + (i % 4) * 5}
              height={8 + (i % 4) * 5}
              viewBox="0 0 24 24"
              fill={i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#ff2244' : '#dc2626'}
              className="drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]"
            >
              <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
            </svg>
          </div>
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.85)_100%)]" />
      </div>

      <div className="relative z-10 flex flex-col w-full h-full">
        {/* Header Bar Control */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur-md border-b border-red-950/80 shadow-lg">
          {/* Kiri: Countdown angka (Abu-abu) */}
          <div className="flex items-center">
            <span className="inline-flex items-center rounded-lg bg-gray-800/90 border border-gray-700/80 px-3 py-1.5 text-xs font-semibold text-gray-300 font-mono shadow-sm">
              {!canClose ? `close in ${countdown}` : 'close in 0'}
            </span>
          </div>

          {/* Tengah: Skip Iklan (Merah) */}
          <button
            type="button"
            onClick={handleSkipAd}
            disabled={!canClose}
            className={`inline-flex items-center justify-center rounded-xl bg-red-600 px-6 py-2 text-sm font-bold text-white shadow-[0_4px_0_0_#991b1b] transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-[0_5px_0_0_#991b1b] active:translate-y-0.5 active:shadow-[0_2px_0_0_#991b1b] ${
              !canClose ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            Skip Iklan
          </button>

          {/* Kanan: Beli Premium (Emas) */}
          <button
            type="button"
            onClick={handlePremiumClick}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-4 py-2 text-sm font-extrabold text-slate-950 shadow-[0_4px_0_0_#b45309] border border-amber-300 transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5 active:shadow-[0_2px_0_0_#b45309]"
          >
            <Crown className="mr-1.5 h-4 w-4 fill-current text-slate-950" />
            Beli Premium
          </button>
        </div>

        {/* Ads Content Container */}
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
          <div className="grid md:grid-cols-2 gap-3 w-full max-w-5xl max-h-full">
            {displayAds.map((ad, index) => (
              <AdItem key={ad.id || index} ad={ad} onAdClick={handleAdClick} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function AdItem({ ad, onAdClick }) {
  const alt = ad.image_alt || ad.title || 'Advertisement';
  const title = ad.title || ad.image_alt || '';
  return (
    <div
      onClick={() => onAdClick(ad)}
      className={`relative overflow-hidden flex items-center justify-center min-h-0 ${
        ad.link_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      }`}
      title={title || undefined}
    >
      <LazyImage
        src={getImageUrl(ad.image)}
        alt={alt}
        title={title || undefined}
        className="w-full h-auto max-h-[75vh] object-contain block"
        wrapperClassName="w-full h-full min-h-0 flex items-center justify-center"
      />
    </div>
  );
}

export default AdPopup;

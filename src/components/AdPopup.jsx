import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl, apiClient } from '../utils/api';
import LazyImage from './LazyImage';
import { useAds } from '../hooks/useAds';

const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const INITIAL_DELAY_MINUTES = 5;
const STORAGE_KEY = 'adPopupStateV2';

/**
 * AdPopup component to display popup ads.
 * - Desktop: 3 kiri, 3 kanan (6 ads). Mobile: 6 items dengan jarak.
 * - Tidak bisa di-close selama 10 detik pertama (no skip 10 detik).
 * - Slot waktu sesuai setting menit (10, 15, 20, ..., 60) dari admin.
 */
const AdPopup = () => {
  const navigate = useNavigate();
  const { ads, loading } = useAds('popup');
  const [isOpen, setIsOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(10);
  const [settingsReady, setSettingsReady] = useState(false);
  const [pendingPremiumRedirect, setPendingPremiumRedirect] = useState(false);
  const isOpenRef = useRef(false);
  const fallbackTimingStateRef = useRef(null);

  const UNLOCK_SECONDS = 10;

  useEffect(() => {
    apiClient
      .getSettings()
      .then((s) => {
        const v = s.popup_ads_interval_minutes;
        if (Number.isFinite(v) && POPUP_INTERVAL_OPTIONS.includes(v)) {
          setSlotIntervalMinutes(v);
        }
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
      // ignore storage write failures (private mode, quota, etc)
    }
  };

  // Jadwal popup: jangan jalan sampai getSettings selesai (default 10 menit), baru pakai interval dari admin
  useEffect(() => {
    if (!settingsReady || !ads.length || loading) return;

    const UNLOCK_MS = UNLOCK_SECONDS * 1000;
    const INITIAL_DELAY_MS = INITIAL_DELAY_MINUTES * 60 * 1000;

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
          setCountdown(UNLOCK_SECONDS);
          return;
        }

        const cycleIndex = Math.floor((now - firstPopupAt) / intervalMs);
        const cycleStartedAt = firstPopupAt + cycleIndex * intervalMs;
        const elapsedMs = now - cycleStartedAt;

        if (state.lastShownCycle !== cycleIndex) {
          state.lastShownCycle = cycleIndex;
          writeTimingState(state);
          setIsOpen(true);
          setCanClose(false);
          setCountdown(UNLOCK_SECONDS);
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
          UNLOCK_SECONDS - Math.floor(elapsedMs / 1000)
        );

        if (!isOpenRef.current) setIsOpen(true);

        setCanClose(remainingSeconds === 0);
        setCountdown(remainingSeconds);

        if (remainingSeconds === 0 && isOpenRef.current) {
          setIsOpen(false);
        }
      } catch (error) {
        console.error('Error handling ad popup slot timing:', error);
        if (!isOpenRef.current) {
          setIsOpen(true);
          setCanClose(false);
          setCountdown(UNLOCK_SECONDS);
        }
      }
    };

    checkAndHandleSchedule();

    const interval = setInterval(() => {
      checkAndHandleSchedule();
    }, 1000);

    return () => clearInterval(interval);
  }, [settingsReady, ads.length, loading, slotIntervalMinutes]);

  // Effect to prevent body scroll when popup is open
  useEffect(() => {
    if (isOpen) {
      // Save current overflow style
      const originalOverflow = document.body.style.overflow;
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore original overflow when popup closes
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
    if (canClose) {
      setIsOpen(false);
      navigate('/premium');
      return;
    }

    setPendingPremiumRedirect(true);
  };

  const handleAdClick = (ad) => {
    if (ad.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Don't render if no ads or not open
  if (!isOpen || !ads.length) {
    return null;
  }

  const displayAds = ads.slice(0, 6);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col w-full h-full bg-slate-800">
      {/* Fullscreen: mobile = 1 kolom 6 ke bawah; desktop = 3 kiri + 3 kanan */}
      <div className="absolute inset-0 flex flex-col justify-center w-full h-full">
        {/* Bar atas: countdown kiri, tombol close kanan (seperti screenshot mobile) */}
        <div className="flex-shrink-0 flex items-center justify-between md:justify-center md:gap-5 px-4 py-3 bg-slate-800 z-10">
          {!canClose ? (
            <span className="text-white text-sm font-medium">Close in {countdown}</span>
          ) : (
            <span />
          )}
          <button
            onClick={handlePremiumClick}
            className={`px-3 py-1.5 rounded text-white text-sm font-medium transition-opacity ${
              canClose ? 'opacity-100 cursor-pointer bg-amber-600 hover:bg-amber-700' : 'opacity-100 cursor-pointer bg-amber-600/80 hover:bg-amber-700'
            }`}
            aria-label="Beli premium"
          >
            Beli Premium
          </button>
        </div>

        {/* Mobile: 1 kolom 6 baris sama tinggi, jarak antar banner. Desktop: 2 kolom × 3 baris */}
        <div className="grid md:grid-cols-2 p-4 gap-2">
          {displayAds.map((ad, index) => (
            <AdItem key={ad.id || index} ad={ad} onAdClick={handleAdClick} />
          ))}
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
      className={`relative rounded-lg overflow-hidden flex items-center justify-center min-h-0 ${
        ad.link_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
      }`}
      title={title || undefined}
    >
      {/* Mobile: isi tinggi baris (1/6). Desktop: max 28vh agar tidak terlalu besar */}
      <LazyImage
        src={getImageUrl(ad.image)}
        alt={alt}
        title={title || undefined}
        className="w-full h-full object-cover"
        wrapperClassName="w-full h-full min-h-0 flex items-center justify-center"
      />
    </div>
  );
}

export default AdPopup;


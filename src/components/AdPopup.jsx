import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl, apiClient } from '../utils/api';
import LazyImage from './LazyImage';
import { useAds } from '../hooks/useAds';

const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const POPUP_INITIAL_DELAY_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30];
const POPUP_UNLOCK_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const DEFAULT_INITIAL_DELAY_MINUTES = 5;
const DEFAULT_UNLOCK_SECONDS = 10;
const STORAGE_KEY = 'adPopupStateV2';

/**
 * AdPopup component to display popup ads.
 * - Desktop: 3 kiri, 3 kanan (6 ads). Mobile: 6 items dengan jarak.
 * - Durasi no-skip & jadwal interval diatur dari admin (settings API).
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

  if (!isOpen || !ads.length) {
    return null;
  }

  const displayAds = ads;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col w-full h-full bg-slate-800">
      <div className="absolute inset-0 flex flex-col justify-center w-full h-full">
        <div className="flex-shrink-0 flex items-center justify-between md:justify-center md:gap-5 px-4 py-3 bg-slate-800 z-10">
          {!canClose ? (
            <span className="text-white text-sm font-medium">Close in {countdown}</span>
          ) : (
            <span />
          )}
        </div>

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

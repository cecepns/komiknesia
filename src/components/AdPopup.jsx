import { useState, useEffect } from 'react';
import { getImageUrl, apiClient } from '../utils/api';
import LazyImage from './LazyImage';
import { useAds } from '../hooks/useAds';

const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

/**
 * AdPopup component to display popup ads.
 * - Desktop: 3 kiri, 3 kanan (6 ads). Mobile: 6 items dengan jarak.
 * - Tidak bisa di-close selama 10 detik pertama (no skip 10 detik).
 * - Slot waktu sesuai setting menit (10, 15, 20, ..., 60) dari admin.
 */
const AdPopup = () => {
  const { ads, loading } = useAds('popup');
  const [isOpen, setIsOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(20);

  const UNLOCK_SECONDS = 10;

  useEffect(() => {
    apiClient.getSettings().then((s) => {
      const v = s.popup_ads_interval_minutes;
      if (Number.isFinite(v) && POPUP_INTERVAL_OPTIONS.includes(v)) {
        setSlotIntervalMinutes(v);
      }
    }).catch(() => {});
  }, []);

  const getCurrentSlotKey = () => {
    if (typeof window === 'undefined') return null;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const slotIndex = Math.floor(minute / slotIntervalMinutes);
    const slotMinute = slotIndex * slotIntervalMinutes;

    return `${year}-${month}-${day}-${hour}-${slotMinute}`;
  };

  // Jadwal popup berdasarkan slot waktu (00, 20, 40) dengan penyimpanan di localStorage
  useEffect(() => {
    if (!ads.length || loading) return;

    const STORAGE_KEY = 'adPopupState';
    const UNLOCK_MS = UNLOCK_SECONDS * 1000;

    const checkAndHandleSlot = () => {
      if (typeof window === 'undefined') return;

      const currentSlotKey = getCurrentSlotKey();
      if (!currentSlotKey) return;

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        let state = raw ? JSON.parse(raw) : null;
        const now = Date.now();

        // Slot baru -> buka popup dan catat waktu buka
        if (!state || state.slotKey !== currentSlotKey) {
          state = {
            slotKey: currentSlotKey,
            openedAt: now,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

          setIsOpen(true);
          setCanClose(false);
          setCountdown(UNLOCK_SECONDS);
          return;
        }

        // Slot yang sama: cek sudah berapa lama popup "aktif"
        const elapsedMs = now - state.openedAt;

        // Jika sudah lewat dari 10 detik -> jendela slot selesai, jangan buka lagi
        if (elapsedMs >= UNLOCK_MS) {
          if (isOpen) {
            setIsOpen(false);
          }
          setCanClose(true);
          setCountdown(0);
          return;
        }

        // Masih dalam jendela 10 detik -> pastikan popup tetap terbuka
        const remainingSeconds = Math.max(
          0,
          UNLOCK_SECONDS - Math.floor(elapsedMs / 1000)
        );

        if (!isOpen) {
          setIsOpen(true);
        }

        // Selama masih ada sisa detik, tombol close tetap disabled (no skip)
        setCanClose(remainingSeconds === 0);
        setCountdown(remainingSeconds);

        // Jika tepat mencapai 0, auto-close popup
        if (remainingSeconds === 0 && isOpen) {
          setIsOpen(false);
        }
      } catch (error) {
        console.error('Error handling ad popup slot timing:', error);
        // Fallback: kalau ada error localStorage, tetap buka popup
        if (!isOpen) {
          setIsOpen(true);
          setCanClose(false);
          setCountdown(UNLOCK_SECONDS);
        }
      }
    };

    // Cek sekali di awal (untuk kasus user masuk di tengah slot)
    checkAndHandleSlot();

    // Lalu cek berkala, supaya kalau user stay dan lewat menit 00/20/40 tetap muncul
    const interval = setInterval(() => {
      checkAndHandleSlot();
    }, 1000); // cek tiap detik, cukup ringan

    return () => clearInterval(interval);
  }, [ads.length, loading, isOpen, slotIntervalMinutes]);

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

  const handleClose = () => {
    if (canClose) {
      setIsOpen(false);
    }
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
            onClick={handleClose}
            disabled={!canClose}
            className={`px-3 py-1.5 rounded text-white text-sm font-medium transition-opacity ${
              canClose ? 'opacity-100 cursor-pointer bg-red-600 hover:bg-red-700' : 'opacity-50 cursor-not-allowed bg-gray-600'
            }`}
            aria-label="Close popup"
          >
            Close
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


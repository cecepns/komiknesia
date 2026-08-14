import { useState, useEffect, useLayoutEffect, useRef } from "react";
import LazyImage from "./LazyImage";
import { getImageUrl } from "../utils/api";

/** Key lama (sebelum dismiss hanya in-memory) — dibersihkan tiap mount agar reload selalu bisa menampilkan lagi */
function legacyDismissedKey(position) {
  return `komiknesia_floating_fixed_${position}_dismissed_ad_id`;
}

/**
 * Iklan mengambang fixed, rata tengah horizontal — slot atas / bawah layout.
 * Slot atas: tombol close di bawah banner. Slot bawah: close di atas banner.
 * Tutup hanya untuk kunjungan ini; reload halaman / kembali dari BFCache menampilkan lagi.
 */
const FloatingFixedAd = ({ position, ads }) => {
  const [dismissedIds, setDismissedIds] = useState([]);

  const getAdId = (ad, index) => (ad?.id != null ? String(ad.id) : `ad-idx-${index}`);
  const currentIds = (ads || []).map((ad, index) => getAdId(ad, index));
  const prevIdsRef = useRef([]);

  useLayoutEffect(() => {
    try {
      localStorage.removeItem(legacyDismissedKey(position));
    } catch {
      /* ignore */
    }
  }, [position]);

  // Pulihkan setelah navigasi back/forward (bfcache) — state React di-restore tapi user mengharap iklan tampil lagi
  useEffect(() => {
    const onPageShow = (e) => {
      if (e.persisted) setDismissedIds([]);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Tampilkan lagi otomatis jika creative baru masuk (yang sebelumnya tidak ada)
  useEffect(() => {
    const newIds = currentIds.filter((id) => !prevIdsRef.current.includes(id));
    if (newIds.length > 0) {
      setDismissedIds((prev) => prev.filter((id) => !newIds.includes(id)));
    }
    prevIdsRef.current = currentIds;
  }, [JSON.stringify(currentIds)]);

  const activeAds = (ads || []).filter((ad, index) => {
    if (!ad) return false;
    const adId = getAdId(ad, index);
    return !dismissedIds.includes(adId);
  });

  if (activeAds.length === 0) return null;

  const handleDismissAll = (e) => {
    e.stopPropagation();
    const activeIds = activeAds.map((ad, index) => getAdId(ad, index));
    setDismissedIds((prev) => [...prev, ...activeIds]);
  };

  const isTop = position === "top";

  const closeBtn = (
    <button
      type="button"
      onClick={handleDismissAll}
      className={`relative z-[2] bg-red-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-red-800/60 transition-colors hover:bg-red-500 ${
        isTop
          ? "mt-[-1px] rounded-b-md rounded-t-none"
          : "mb-[-1px] rounded-t-md rounded-b-none"
      }`}
      aria-label="Tutup iklan"
    >
      X Close
    </button>
  );

  const containerClass = `pointer-events-auto fixed left-1/2 z-[48] flex flex-col items-center -translate-x-1/2 px-0 transition-all ${
    isTop
      ? "top-[56px] md:top-[64px]"
      : "bottom-[calc(52px+env(safe-area-inset-bottom,0px))] md:bottom-0"
  } ${
    activeAds.length > 1
      ? "w-full max-w-[728px] md:max-w-[1000px]"
      : "w-full max-w-[728px]"
  }`;

  const adsWrapperClass =
    activeAds.length > 1
      ? "grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0 w-full justify-items-center"
      : "flex flex-col gap-0 w-full items-center";

  return (
    <div className={containerClass}>
      {!isTop && closeBtn}

      <div className={adsWrapperClass}>
        {activeAds.map((ad, index) => {
          const adId = getAdId(ad, index);
          const openLink = () => {
            if (ad.link_url) {
              window.open(ad.link_url, "_blank", "noopener,noreferrer");
            }
          };

          return (
            <div
              key={adId}
              role={ad.link_url ? "button" : undefined}
              tabIndex={ad.link_url ? 0 : undefined}
              onClick={ad.link_url ? openLink : undefined}
              onKeyDown={
                ad.link_url
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openLink();
                      }
                    }
                  : undefined
              }
              className={`w-full aspect-[728/90] overflow-hidden bg-black/90 shadow-2xl ${
                ad.link_url ? "cursor-pointer" : ""
              }`}
            >
              <LazyImage
                src={getImageUrl(ad.image)}
                alt={ad.image_alt || ad.title || "Iklan"}
                title={ad.title || ad.image_alt || undefined}
                className="w-full h-full object-fill block"
                wrapperClassName="block w-full h-full"
              />
            </div>
          );
        })}
      </div>

      {isTop && closeBtn}
    </div>
  );
};

export default FloatingFixedAd;

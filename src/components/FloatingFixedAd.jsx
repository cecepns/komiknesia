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

  const isTop = position === "top";

  return (
    <div
      className={`pointer-events-auto fixed left-1/2 z-[48] flex w-[min(100vw-1rem,728px)] max-w-full -translate-x-1/2 flex-col gap-3 items-center px-2 ${
        isTop
          ? "top-14 md:top-20"
          : "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-3"
      }`}
    >
      {activeAds.map((ad, index) => {
        const adId = getAdId(ad, index);
        const openLink = () => {
          if (ad.link_url) {
            window.open(ad.link_url, "_blank", "noopener,noreferrer");
          }
        };

        const closeBtn = (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDismissedIds((prev) => [...prev, adId]);
            }}
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

        const adPanel = (
          <div
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
            className={`w-full overflow-hidden bg-slate-900/40 shadow-2xl ring-1 ring-white/20 dark:bg-black/50 ${
              isTop ? "rounded-t-xl rounded-b-none" : "rounded-b-xl rounded-t-none"
            } ${ad.link_url ? "cursor-pointer" : ""}`}
          >
            <LazyImage
              src={getImageUrl(ad.image)}
              alt={ad.image_alt || ad.title || "Iklan"}
              title={ad.title || ad.image_alt || undefined}
              className="max-h-[100px] w-full object-contain sm:max-h-[120px] md:max-h-[140px]"
              wrapperClassName="block w-full"
            />
          </div>
        );

        return (
          <div key={adId} className="w-full flex flex-col items-center">
            {isTop ? (
              <>
                {adPanel}
                {closeBtn}
              </>
            ) : (
              <>
                {closeBtn}
                {adPanel}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FloatingFixedAd;

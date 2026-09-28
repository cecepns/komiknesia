import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

let adsCache = null;
let adsCacheExpiresAt = 0;
let adsCachePromise = null;
const ADS_CACHE_TTL_MS = 60 * 1000; // 60 detik cache

async function getAdsWithCache() {
  const now = Date.now();

  if (adsCache && adsCacheExpiresAt > now) {
    return adsCache;
  }

  if (adsCachePromise) {
    return adsCachePromise;
  }

  adsCachePromise = apiClient
    .getAds()
    .then((data) => {
      const items = Array.isArray(data) ? data : [];
      adsCache = items;
      adsCacheExpiresAt = Date.now() + ADS_CACHE_TTL_MS;
      return adsCache;
    })
    .catch((err) => {
      console.warn('[useAds] Failed to fetch ads:', err.message);
      return [];
    })
    .finally(() => {
      adsCachePromise = null;
    });

  return adsCachePromise;
}

export const useAds = (adsType, limit = null, enabled = true) => {
  const { user, loading: authLoading } = useAuth();
  // Khusus Mobile: Pengguna berstatus bebas iklan HANYA jika memiliki VIP / membership aktif
  // DAN membership_type secara spesifik adalah 'mobile' atau 'both'.
  // Admin tanpa VIP mobile TETAP melihat iklan!
  const membershipType = String(user?.membership_type || '').toLowerCase().trim();
  const isMobileMembership = membershipType === 'mobile' || membershipType === 'both';
  const hasVipOrActive = Boolean(user?.membership_active || user?.role === 'vip' || user?.role === 'premium');
  const isPremiumUser = hasVipOrActive && isMobileMembership;
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAds = async () => {
      try {
        setLoading(true);
        setError(null);
        const allAds = await getAdsWithCache();

        if (!isMounted) return;

        // Filter by ads_type, platform (hanya 'mobile', 'both', 'keduanya', 'all') and active/unexpired (tanpa limit)
        let filteredAds = allAds.filter((ad) => {
          if (ad.ads_type !== adsType) return false;

          // Khusus mobile: hanya munculkan jika category Platform di apinya mobile / keduanya (both/keduanya/all).
          // Jangan munculkan jika web saja.
          const platform = String(ad.target_platform || '').toLowerCase().trim();
          const isAllowedPlatform =
            platform === 'mobile' ||
            platform === 'both' ||
            platform === 'keduanya' ||
            platform === 'all';
          if (!isAllowedPlatform) {
            return false;
          }

          if (ad.is_active === 0 || ad.is_active === false) return false;
          if (!ad.expired_at) return true;
          const expiresAt = new Date(ad.expired_at).getTime();
          return !Number.isFinite(expiresAt) || expiresAt >= Date.now();
        });

        // Sort by display_order ascending
        filteredAds.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        // TIDAK ADA LIMIT untuk banner ads - tampilkan semua iklan aktif
        setAds(filteredAds);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message);
        setAds([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (authLoading) {
      setAds([]);
      setLoading(true);
      return;
    }

    if (adsType && enabled && !isPremiumUser) {
      fetchAds();
    } else {
      setAds([]);
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [adsType, limit, enabled, isPremiumUser, authLoading]);

  return { ads, loading, error };
};

import { useState, useEffect } from 'react';
import { apiClient } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

// Simple in-memory cache shared across all hook usages in this tab.
// Ini memastikan /api/ads hanya dipanggil sekali (per TTL) meskipun
// banyak komponen memanggil useAds dengan adsType berbeda.
let adsCache = null;
let adsCacheExpiresAt = 0;
let adsCachePromise = null;
const ADS_CACHE_TTL_MS = 60 * 1000; // 60 detik

async function getAdsWithCache() {
  const now = Date.now();

  // Return cached data if masih valid
  if (adsCache && adsCacheExpiresAt > now) {
    return adsCache;
  }

  // Kalau sudah ada request berjalan, tunggu promise yang sama
  if (adsCachePromise) {
    return adsCachePromise;
  }

  // Buat request baru dan simpan sebagai promise bersama
  adsCachePromise = apiClient
    .getAds()
    .then((data) => {
      adsCache = data || [];
      adsCacheExpiresAt = Date.now() + ADS_CACHE_TTL_MS;
      return adsCache;
    })
    .finally(() => {
      adsCachePromise = null;
    });

  return adsCachePromise;
}

/**
 * Custom hook untuk mengambil ads berdasarkan type.
 * Semua instance share hasil /api/ads yang sama lewat cache di atas.
 */
export const useAds = (adsType, limit = null, enabled = true) => {
  const { user, loading: authLoading } = useAuth();
  const isPremiumUser = !!user?.membership_active;
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        setLoading(true);
        setError(null);
        const allAds = await getAdsWithCache();
        
        // Filter ads by type
        let filteredAds = allAds.filter(ad => ad.ads_type === adsType);
        
        // Apply limit if specified
        if (limit && limit > 0) {
          filteredAds = filteredAds.slice(0, limit);
        }
        
        setAds(filteredAds);
      } catch (err) {
        console.error('Error fetching ads:', err);
        setError(err.message);
        setAds([]);
      } finally {
        setLoading(false);
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
  }, [adsType, limit, enabled, isPremiumUser, authLoading]);

  return { ads, loading, error };
};







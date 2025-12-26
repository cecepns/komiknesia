import { useState, useEffect } from 'react';
import { apiClient, getImageUrl } from '../utils/api';

/**
 * Custom hook to fetch ads by type
 * @param {string} adsType - The type of ads to fetch
 * @param {number} limit - Maximum number of ads to return
 * @returns {Object} { ads, loading, error }
 */
export const useAds = (adsType, limit = null) => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        setLoading(true);
        setError(null);
        const allAds = await apiClient.getAds();
        
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

    if (adsType) {
      fetchAds();
    } else {
      setAds([]);
      setLoading(false);
    }
  }, [adsType, limit]);

  return { ads, loading, error };
};







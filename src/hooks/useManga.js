import { useState, useEffect } from 'react';
import { apiClient } from '../utils/api';

export const useManga = (page = 1, search = '', category = '') => {
  const [manga, setManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchManga = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getManga(page, 10, search, category);
        setManga(response.manga);
        setTotalPages(response.totalPages);
        setError(null);
      } catch (err) {
        setError(err.message);
        setManga([]);
      } finally {
        setLoading(false);
      }
    };

    fetchManga();
  }, [page, search, category]);

  return { manga, loading, error, totalPages };
};
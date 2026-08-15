/**
 * Save manga to reading history (includes last read chapter)
 * Keeps only the last 100 items
 * @param {Object} item - { mangaSlug, mangaTitle, cover, chapterSlug?, chapterNumber?, chapterTitle? }
 */
export const saveToHistory = (item) => {
  try {
    const existingHistory = localStorage.getItem('mangaHistory');
    let history = existingHistory ? JSON.parse(existingHistory) : [];

    // Remove duplicate by manga slug (manga-only history)
    history = history.filter((h) => h.mangaSlug !== item.mangaSlug);

    history.unshift({
      mangaSlug: item.mangaSlug,
      mangaTitle: item.mangaTitle,
      cover: item.cover,
      chapterSlug: item.chapterSlug || null,
      chapterNumber: item.chapterNumber || null,
      chapterTitle: item.chapterTitle || null,
      chapterCreatedAt: item.chapterCreatedAt || null,
      isLatestChapter: !!item.isLatestChapter,
      timestamp: Date.now(),
    });

    history = history.slice(0, 100);
    localStorage.setItem('mangaHistory', JSON.stringify(history));

    // Also update komiknesia_history for chapter read status tracking
    if (item.chapterSlug) {
      try {
        const komikHistoryRaw = localStorage.getItem('komiknesia_history');
        let komikHistory = komikHistoryRaw ? JSON.parse(komikHistoryRaw) : [];
        if (!komikHistory.some((h) => h.chapterSlug === item.chapterSlug)) {
          komikHistory.unshift({
            chapterSlug: item.chapterSlug,
            mangaSlug: item.mangaSlug,
            timestamp: Date.now(),
          });
          komikHistory = komikHistory.slice(0, 500);
          localStorage.setItem('komiknesia_history', JSON.stringify(komikHistory));
        }
      } catch {
        /* ignore */
      }
    }
  } catch (error) {
    console.error('Error saving history:', error);
  }
};

/**
 * Get reading history from localStorage
 */
export const getHistory = () => {
  try {
    const history = localStorage.getItem('mangaHistory');
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error getting history:', error);
    return [];
  }
};

/**
 * Remove single manga from history
 * @param {string} mangaSlug
 */
export const removeFromHistory = (mangaSlug) => {
  try {
    const existingHistory = localStorage.getItem('mangaHistory');
    if (!existingHistory) return;
    const history = JSON.parse(existingHistory).filter((h) => h.mangaSlug !== mangaSlug);
    localStorage.setItem('mangaHistory', JSON.stringify(history));
  } catch (error) {
    console.error('Error removing from history:', error);
  }
};

/**
 * Clear all reading history
 */
export const clearHistory = () => {
  try {
    localStorage.removeItem('mangaHistory');
  } catch (error) {
    console.error('Error clearing history:', error);
  }
};

/**
 * Save manga reading history to localStorage
 * Keeps only the last 5 items
 */
export const saveToHistory = (historyItem) => {
  try {
    // Get existing history
    const existingHistory = localStorage.getItem('mangaHistory');
    let history = existingHistory ? JSON.parse(existingHistory) : [];

    // Remove duplicate entries (same manga and chapter)
    history = history.filter(
      item => !(item.mangaSlug === historyItem.mangaSlug && item.chapterSlug === historyItem.chapterSlug)
    );

    // Add new item at the beginning
    history.unshift({
      ...historyItem,
      timestamp: Date.now()
    });

    // Keep only last 5 items
    history = history.slice(0, 5);

    // Save to localStorage
    localStorage.setItem('mangaHistory', JSON.stringify(history));
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
 * Clear all reading history
 */
export const clearHistory = () => {
  try {
    localStorage.removeItem('mangaHistory');
  } catch (error) {
    console.error('Error clearing history:', error);
  }
};

/**
 * ── Read‑chapter tracking (lightweight comma‑separated Set) ──
 *
 * localStorage key : "komiknesia_read"
 * value            : "slug1,slug2,slug3,..."
 *
 * ~30 bytes per slug → 150 000+ entries within 5 MB localStorage limit.
 * Lookup is O(1) via Set; save is a simple string concat.
 */

const READ_KEY = 'komiknesia_read';
const OLD_KEY = 'komiknesia_history'; // legacy JSON array key

/** One‑time migration: move old JSON array → comma string, then delete old key. */
function migrateIfNeeded() {
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (!old) return;
    const arr = JSON.parse(old);
    if (!Array.isArray(arr) || arr.length === 0) {
      localStorage.removeItem(OLD_KEY);
      return;
    }
    const slugs = new Set();
    arr.forEach((item) => {
      if (item.chapterSlug) slugs.add(item.chapterSlug);
      if (item.slug) slugs.add(item.slug);
    });
    if (slugs.size > 0) {
      const existing = localStorage.getItem(READ_KEY) || '';
      const merged = new Set([
        ...existing.split(',').filter(Boolean),
        ...slugs,
      ]);
      localStorage.setItem(READ_KEY, [...merged].join(','));
    }
    localStorage.removeItem(OLD_KEY);
  } catch {
    // corrupt data – just remove old key
    try { localStorage.removeItem(OLD_KEY); } catch { /* */ }
  }
}

// Run migration on module load (runs once per page load)
migrateIfNeeded();

/**
 * Returns a Set<string> of all chapter slugs the user has read.
 * Merges slugs from both `komiknesia_read` and `mangaHistory`.
 */
export const getReadChapterSlugs = () => {
  const set = new Set();
  try {
    const raw = localStorage.getItem(READ_KEY) || '';
    if (raw) {
      const parts = raw.split(',');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) set.add(parts[i]);
      }
    }
  } catch { /* */ }

  // Also include chapterSlug entries from mangaHistory (fallback)
  try {
    const mh = JSON.parse(localStorage.getItem('mangaHistory') || '[]');
    for (let i = 0; i < mh.length; i++) {
      if (mh[i].chapterSlug) set.add(mh[i].chapterSlug);
    }
  } catch { /* */ }

  return set;
};

/**
 * Mark a single chapter slug as read.
 * O(1) string append — no JSON parse/stringify.
 */
export const markChapterRead = (chapterSlug) => {
  if (!chapterSlug) return;
  try {
    const raw = localStorage.getItem(READ_KEY) || '';
    // Quick duplicate check via string search (avoids building a Set)
    if ((',' + raw + ',').includes(',' + chapterSlug + ',')) return;
    localStorage.setItem(
      READ_KEY,
      raw ? raw + ',' + chapterSlug : chapterSlug,
    );
  } catch { /* localStorage full — silently ignore */ }
};


/**
 * ── Manga reading history (last‑read chapter per manga) ──
 *
 * Keeps only the last 100 items in `mangaHistory`.
 */

/**
 * Save manga to reading history (includes last read chapter).
 * Also marks the chapter as read in the lightweight store.
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

    // Mark chapter as read in the lightweight comma store
    if (item.chapterSlug) {
      markChapterRead(item.chapterSlug);
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

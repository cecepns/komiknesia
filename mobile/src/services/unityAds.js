import AsyncStorage from '@react-native-async-storage/async-storage';

export const UNITY_ADS_CONFIG = {
  appKey: '28493c2b5',
  chapterUnlockPlacementId: '7o3gto0gcwtty59h',
  downloadUnlockPlacementId: 'hsrnf275hhrcsibz',
  chapterThreshold: 5, // Muncul setiap baca/buka chapter 5x
  downloadThreshold: 3, // Muncul setiap download 3x
};

const CHAPTER_READ_COUNTER_KEY = '@komiknesia_chapter_read_count';
const DOWNLOAD_COUNTER_KEY = '@komiknesia_download_count';

export const unityAdsService = {
  /**
   * Catat pembukaan chapter.
   * Muncul setiap baca/buka chapter kelipatan 5x (5, 10, 15, 20...).
   * Khusus Premium: Bebas iklan (return false).
   * @param {boolean} [isVip=false]
   * @returns {Promise<{ shouldShow: boolean, count: number, placementId: string, appKey: string }>}
   */
  async trackChapterRead(isVip = false) {
    if (isVip) {
      return { shouldShow: false, count: 0, isVip: true };
    }

    try {
      const stored = await AsyncStorage.getItem(CHAPTER_READ_COUNTER_KEY);
      const current = stored ? parseInt(stored, 10) : 0;
      const nextCount = current + 1;
      await AsyncStorage.setItem(CHAPTER_READ_COUNTER_KEY, nextCount.toString());

      // Kelipatan 5, 10, 15, 20...
      const shouldShow = nextCount > 0 && nextCount % 5 === 0;

      return {
        shouldShow,
        count: nextCount,
        placementId: UNITY_ADS_CONFIG.chapterUnlockPlacementId,
        appKey: UNITY_ADS_CONFIG.appKey,
        type: 'chapter',
      };
    } catch {
      return { shouldShow: false, count: 0 };
    }
  },

  /**
   * Catat aktivitas unduhan chapter.
   * Muncul setiap download kelipatan 5x (5, 10, 15, 20...).
   * Khusus Premium: Bebas iklan (return false).
   * @param {boolean} [isVip=false]
   * @returns {Promise<{ shouldShow: boolean, count: number, placementId: string, appKey: string }>}
   */
  async trackDownload(isVip = false) {
    if (isVip) {
      return { shouldShow: false, count: 0, isVip: true };
    }

    try {
      const stored = await AsyncStorage.getItem(DOWNLOAD_COUNTER_KEY);
      const current = stored ? parseInt(stored, 10) : 0;
      const nextCount = current + 1;
      await AsyncStorage.setItem(DOWNLOAD_COUNTER_KEY, nextCount.toString());

      // Kelipatan 5, 10, 15, 20...
      const shouldShow = nextCount > 0 && nextCount % 5 === 0;

      return {
        shouldShow,
        count: nextCount,
        placementId: UNITY_ADS_CONFIG.downloadUnlockPlacementId,
        appKey: UNITY_ADS_CONFIG.appKey,
        type: 'download',
      };
    } catch {
      return { shouldShow: false, count: 0 };
    }
  },

  async getCounts() {
    try {
      const ch = (await AsyncStorage.getItem(CHAPTER_READ_COUNTER_KEY)) || '0';
      const dl = (await AsyncStorage.getItem(DOWNLOAD_COUNTER_KEY)) || '0';
      return {
        chapterCount: parseInt(ch, 10),
        downloadCount: parseInt(dl, 10),
      };
    } catch {
      return { chapterCount: 0, downloadCount: 0 };
    }
  },
};

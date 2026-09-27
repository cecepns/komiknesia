import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Private credentials - internal SDK usage only, NEVER rendered in client UI
export const UNITY_ADS_CONFIG = {
  appKey: '28493c2b5',
  chapterUnlockPlacementId: '7o3gto0gcwtty59h',
  downloadUnlockPlacementId: 'hsrnf275hhrcsibz',
  chapterThreshold: 5, // Muncul setiap baca/buka chapter 5x
  downloadThreshold: 3, // Muncul setiap download 3x
};

const CHAPTER_READ_COUNTER_KEY = '@komiknesia_chapter_read_count';
const DOWNLOAD_COUNTER_KEY = '@komiknesia_download_count';

let LevelPlay = null;
let LevelPlayInitRequest = null;
let LevelPlayRewardedAd = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lpModule = require('unity-levelplay-mediation');
  LevelPlay = lpModule.LevelPlay;
  LevelPlayInitRequest = lpModule.LevelPlayInitRequest;
  LevelPlayRewardedAd = lpModule.LevelPlayRewardedAd;
} catch (e) {
  // Graceful fallback if native module is not ready in current environment
  console.log('[UnityAds] Native module not loaded:', e?.message || e);
}

let isInitialized = false;
let isInitializing = false;
let chapterRewardedAd = null;
let downloadRewardedAd = null;

export const unityAdsService = {
  /**
   * Inisialisasi SDK resmi Unity LevelPlay di background.
   */
  async init() {
    if (isInitialized || isInitializing || Platform.OS !== 'android' || !LevelPlay) return;
    isInitializing = true;
    try {
      const initRequest = LevelPlayInitRequest.builder(UNITY_ADS_CONFIG.appKey).build();
      await LevelPlay.init(initRequest, {
        onInitSuccess: () => {
          isInitialized = true;
          isInitializing = false;
          // Preload ad units
          unityAdsService.loadRewardedAd('chapter');
          unityAdsService.loadRewardedAd('download');
        },
        onInitFailed: (err) => {
          console.warn('[UnityAds] Init failed:', err);
          isInitializing = false;
        },
      });
    } catch (err) {
      console.warn('[UnityAds] Init exception:', err);
      isInitializing = false;
    }
  },

  /**
   * Pre-load iklan rewarded sesuai tipe
   */
  loadRewardedAd(type = 'chapter') {
    if (!isInitialized || !LevelPlayRewardedAd) return;
    try {
      const placementId =
        type === 'download'
          ? UNITY_ADS_CONFIG.downloadUnlockPlacementId
          : UNITY_ADS_CONFIG.chapterUnlockPlacementId;

      const ad = new LevelPlayRewardedAd(placementId);
      ad.setListener({
        onAdLoaded: () => {},
        onAdLoadFailed: (err) => {
          console.log(`[UnityAds] ${type} ad load failed:`, err);
        },
        onAdDisplayed: () => {},
        onAdClosed: () => {
          // Preload lagi untuk tayangan berikutnya
          unityAdsService.loadRewardedAd(type);
        },
        onAdRewarded: () => {},
      });
      ad.loadAd().catch(() => {});
      if (type === 'download') downloadRewardedAd = ad;
      else chapterRewardedAd = ad;
    } catch (err) {
      console.warn('[UnityAds] loadAd error:', err);
    }
  },

  /**
   * Tampilkan iklan video rewarded asli dari Unity Ads ke client.
   * Mengembalikan true jika iklan video berhasil diputar.
   */
  async showNativeRewardedAd(type = 'chapter', onReward, onClose) {
    if (Platform.OS !== 'android' || !LevelPlayRewardedAd) return false;
    await this.init();
    const ad = type === 'download' ? downloadRewardedAd : chapterRewardedAd;
    if (ad) {
      try {
        const isReady = await ad.isAdReady().catch(() => false);
        if (isReady) {
          let rewarded = false;
          ad.setListener({
            onAdLoaded: () => {},
            onAdLoadFailed: () => {},
            onAdDisplayed: () => {},
            onAdClosed: () => {
              if (rewarded && onReward) onReward();
              if (onClose) onClose();
              unityAdsService.loadRewardedAd(type);
            },
            onAdRewarded: () => {
              rewarded = true;
            },
          });
          await ad.showAd();
          return true;
        }
      } catch (e) {
        console.warn('[UnityAds] showAd failed:', e);
      }
    }
    return false;
  },

  /**
   * Catat pembukaan chapter.
   * Muncul setiap baca/buka chapter kelipatan 5x (5, 10, 15, 20...).
   * Khusus Premium: Bebas iklan (return false).
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
      const shouldShow = nextCount > 0 && nextCount % UNITY_ADS_CONFIG.chapterThreshold === 0;

      return {
        shouldShow,
        count: nextCount,
        type: 'chapter',
      };
    } catch {
      return { shouldShow: false, count: 0 };
    }
  },

  /**
   * Catat aktivitas unduhan chapter.
   * Muncul setiap download kelipatan 3x (3, 6, 9, 12...).
   * Khusus Premium: Bebas iklan (return false).
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

      // Kelipatan 3, 6, 9, 12...
      const shouldShow = nextCount > 0 && nextCount % UNITY_ADS_CONFIG.downloadThreshold === 0;

      return {
        shouldShow,
        count: nextCount,
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

// Inisialisasi otomatis di background
unityAdsService.init().catch(() => {});

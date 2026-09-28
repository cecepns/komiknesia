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
let initPromise = null;
let chapterRewardedAd = null;
let downloadRewardedAd = null;
const isAdLoading = { chapter: false, download: false };
const adLoadPromise = { chapter: null, download: null };

export const unityAdsService = {
  /**
   * Inisialisasi SDK resmi Unity LevelPlay di background.
   */
  async init() {
    if (isInitialized) return true;
    if (initPromise) return initPromise;
    if (Platform.OS !== 'android' || !LevelPlay || !LevelPlayInitRequest) {
      return false;
    }

    initPromise = new Promise((resolve) => {
      isInitializing = true;
      try {
        const initRequest = LevelPlayInitRequest.builder(UNITY_ADS_CONFIG.appKey).build();
        LevelPlay.init(initRequest, {
          onInitSuccess: () => {
            isInitialized = true;
            isInitializing = false;
            // Preload ad units
            unityAdsService.loadRewardedAd('chapter');
            unityAdsService.loadRewardedAd('download');
            resolve(true);
          },
          onInitFailed: (err) => {
            console.warn('[UnityAds] Init failed:', err);
            isInitializing = false;
            resolve(false);
          },
        }).catch((err) => {
          console.warn('[UnityAds] Init call error:', err);
          isInitializing = false;
          resolve(false);
        });

        // Timeout fallback for init
        setTimeout(() => {
          if (!isInitialized) {
            isInitializing = false;
            resolve(false);
          }
        }, 8000);
      } catch (err) {
        console.warn('[UnityAds] Init exception:', err);
        isInitializing = false;
        resolve(false);
      }
    });

    return initPromise;
  },

  /**
   * Pre-load iklan rewarded sesuai tipe
   */
  loadRewardedAd(type = 'chapter') {
    if (!isInitialized || !LevelPlayRewardedAd) return null;
    if (isAdLoading[type] && adLoadPromise[type]) {
      return adLoadPromise[type];
    }

    const placementId =
      type === 'download'
        ? UNITY_ADS_CONFIG.downloadUnlockPlacementId
        : UNITY_ADS_CONFIG.chapterUnlockPlacementId;

    try {
      // Clean up previous instance if any
      const prevAd = type === 'download' ? downloadRewardedAd : chapterRewardedAd;
      if (prevAd && typeof prevAd.remove === 'function') {
        prevAd.remove().catch(() => {});
      }

      const ad = new LevelPlayRewardedAd(placementId);
      if (type === 'download') downloadRewardedAd = ad;
      else chapterRewardedAd = ad;

      isAdLoading[type] = true;

      adLoadPromise[type] = new Promise((resolve) => {
        ad.setListener({
          onAdLoaded: () => {
            console.log(`[UnityAds] ${type} ad preloaded successfully`);
            isAdLoading[type] = false;
            resolve(true);
          },
          onAdLoadFailed: (err) => {
            console.log(`[UnityAds] ${type} ad load failed:`, err);
            isAdLoading[type] = false;
            resolve(false);
          },
          onAdDisplayed: () => {},
          onAdDisplayFailed: () => {},
          onAdClosed: () => {
            // Preload fresh ad for next viewing
            unityAdsService.loadRewardedAd(type);
          },
          onAdRewarded: () => {},
        });

        ad.loadAd().catch((e) => {
          console.warn('[UnityAds] loadAd catch:', e);
          isAdLoading[type] = false;
          resolve(false);
        });
      });

      return adLoadPromise[type];
    } catch (err) {
      console.warn('[UnityAds] loadAd error:', err);
      isAdLoading[type] = false;
      return null;
    }
  },

  /**
   * Tampilkan iklan video rewarded asli dari Unity Ads ke client.
   * Mengembalikan object { success: boolean, error?: string }
   */
  async showNativeRewardedAd(type = 'chapter', onReward, onClose) {
    if (Platform.OS !== 'android' || !LevelPlayRewardedAd) {
      return {
        success: false,
        error: 'Iklan video Unity LevelPlay hanya didukung pada aplikasi Android terpasang.',
      };
    }

    const initOk = await this.init();
    if (!initOk) {
      return {
        success: false,
        error: 'Inisialisasi iklan sponsor gagal atau memerlukan waktu lebih lama.',
      };
    }

    let ad = type === 'download' ? downloadRewardedAd : chapterRewardedAd;
    if (!ad) {
      this.loadRewardedAd(type);
      ad = type === 'download' ? downloadRewardedAd : chapterRewardedAd;
    }

    // Check if ad is already ready
    let ready = false;
    try {
      ready = ad ? await ad.isAdReady().catch(() => false) : false;
    } catch {
      ready = false;
    }

    // If not ready, await background preload or start load with 12s timeout
    if (!ready) {
      let loaded = false;
      if (isAdLoading[type] && adLoadPromise[type]) {
        // Already loading in background, wait for it!
        loaded = await Promise.race([
          adLoadPromise[type],
          new Promise((r) => setTimeout(() => r(false), 12000)),
        ]);
      } else {
        // Not loading yet, initiate loading
        const loadP = this.loadRewardedAd(type);
        if (loadP) {
          loaded = await Promise.race([
            loadP,
            new Promise((r) => setTimeout(() => r(false), 12000)),
          ]);
        }
      }

      // Re-verify if ad is ready
      ad = type === 'download' ? downloadRewardedAd : chapterRewardedAd;
      ready = ad ? await ad.isAdReady().catch(() => false) : false;

      if (!ready && !loaded) {
        return {
          success: false,
          error: 'Iklan sponsor gagal dimuat atau sedang cooldown. Silakan periksa jaringan internet atau coba beberapa saat lagi.',
        };
      }
    }

    // Ad is ready, show it
    try {
      let rewarded = false;
      ad.setListener({
        onAdLoaded: () => {},
        onAdLoadFailed: () => {},
        onAdDisplayed: () => {},
        onAdDisplayFailed: (err) => {
          console.warn('[UnityAds] Ad display failed:', err);
          if (onClose) onClose();
        },
        onAdClosed: () => {
          if (rewarded && onReward) {
            onReward();
          } else if (onClose) {
            onClose();
          }
          // Request fresh ad in background for subsequent chapters
          unityAdsService.loadRewardedAd(type);
        },
        onAdRewarded: () => {
          rewarded = true;
        },
      });

      await ad.showAd();
      return { success: true };
    } catch (err) {
      console.warn('[UnityAds] showAd exception:', err);
      return {
        success: false,
        error: err?.message || 'Gagal menampilkan iklan video sponsor.',
      };
    }
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

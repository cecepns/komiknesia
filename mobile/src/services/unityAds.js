import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Private credentials - internal SDK usage only, NEVER rendered in client UI
export const UNITY_ADS_CONFIG = {
  appKey: '28493c2b5',
  chapterUnlockPlacementId: '7o3gto0gcwtty59h',
  downloadUnlockPlacementId: 'hsrnf275hhrcsibz',
  chapterThreshold: 3, // Muncul setiap 3 chapter
  downloadThreshold: 3, // Muncul setiap 3 download
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

// Persistent singleton ad instances per placement
const adInstances = {
  chapter: null,
  download: null,
};

const isAdLoading = { chapter: false, download: false };
const loadWaiters = { chapter: [], download: [] };

const showCallbacks = {
  chapter: { onReward: null, onClose: null, isRewarded: false },
  download: { onReward: null, onClose: null, isRewarded: false },
};

function setupAdListener(ad, type) {
  if (!ad || typeof ad.setListener !== 'function') return;

  ad.setListener({
    onAdLoaded: (adInfo) => {
      console.log(`[UnityAds] ${type} ad loaded successfully:`, adInfo);
      isAdLoading[type] = false;
      const waiters = loadWaiters[type];
      loadWaiters[type] = [];
      waiters.forEach((cb) => {
        try {
          cb(true);
        } catch {}
      });
    },
    onAdLoadFailed: (err) => {
      console.log(`[UnityAds] ${type} ad load failed:`, err);
      isAdLoading[type] = false;
      const waiters = loadWaiters[type];
      loadWaiters[type] = [];
      waiters.forEach((cb) => {
        try {
          cb(false);
        } catch {}
      });
    },
    onAdDisplayed: (adInfo) => {
      console.log(`[UnityAds] ${type} ad displayed:`, adInfo);
    },
    onAdDisplayFailed: (err, adInfo) => {
      console.warn(`[UnityAds] ${type} ad display failed, continuing directly:`, err, adInfo);
      const cb = showCallbacks[type];
      if (cb && cb.onReward) {
        cb.onReward();
      } else if (cb && cb.onClose) {
        cb.onClose();
      }
      showCallbacks[type] = { onReward: null, onClose: null, isRewarded: false };
      // Request fresh ad reload in background
      setTimeout(() => unityAdsService.loadRewardedAd(type), 1000);
    },
    onAdRewarded: (reward, adInfo) => {
      console.log(`[UnityAds] ${type} ad rewarded:`, reward, adInfo);
      if (showCallbacks[type]) {
        showCallbacks[type].isRewarded = true;
      }
    },
    onAdClosed: (adInfo) => {
      console.log(`[UnityAds] ${type} ad closed:`, adInfo);
      const cb = showCallbacks[type];
      const wasRewarded = cb?.isRewarded;
      if (wasRewarded && cb?.onReward) {
        cb.onReward();
      } else if (cb?.onClose) {
        cb.onClose();
      }
      showCallbacks[type] = { onReward: null, onClose: null, isRewarded: false };

      // Langsung muat iklan baru di background untuk chapter berikutnya (tanpa jeda/timer)
      setTimeout(() => {
        unityAdsService.loadRewardedAd(type);
      }, 500);
    },
  });
}

function getOrCreateAd(type) {
  if (!isInitialized || !LevelPlayRewardedAd) return null;
  if (!adInstances[type]) {
    const placementId =
      type === 'download'
        ? UNITY_ADS_CONFIG.downloadUnlockPlacementId
        : UNITY_ADS_CONFIG.chapterUnlockPlacementId;
    const ad = new LevelPlayRewardedAd(placementId);
    setupAdListener(ad, type);
    adInstances[type] = ad;
  }
  return adInstances[type];
}

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
            // Preload unit iklan untuk chapter & download
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
   * Pre-load iklan rewarded sesuai tipe secara non-blocking
   */
  loadRewardedAd(type = 'chapter') {
    if (!isInitialized || !LevelPlayRewardedAd) return null;

    const ad = getOrCreateAd(type);
    if (!ad) return null;

    ad.isAdReady()
      .then((ready) => {
        if (ready) return;
        if (isAdLoading[type]) return;
        isAdLoading[type] = true;
        ad.loadAd().catch((e) => {
          console.warn(`[UnityAds] loadAd (${type}) catch:`, e);
          isAdLoading[type] = false;
        });
      })
      .catch(() => {
        if (!isAdLoading[type]) {
          isAdLoading[type] = true;
          ad.loadAd().catch((e) => {
            console.warn(`[UnityAds] loadAd (${type}) catch:`, e);
            isAdLoading[type] = false;
          });
        }
      });

    return new Promise((resolve) => {
      loadWaiters[type].push(resolve);
      setTimeout(() => {
        resolve(false);
      }, 7000);
    });
  },

  /**
   * Tampilkan iklan video rewarded asli dari Unity Ads ke client.
   * Langsung munculkan tanpa timer / cooldown.
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

    const ad = getOrCreateAd(type);
    if (!ad) {
      return {
        success: false,
        error: 'Unit iklan sponsor tidak dapat diakses.',
      };
    }

    // Cek apakah iklan sudah ready
    let ready = false;
    try {
      ready = await ad.isAdReady().catch(() => false);
    } catch {
      ready = false;
    }

    // Jika belum ready, coba muat dengan timeout singkat (2s)
    if (!ready) {
      const loadPromise = this.loadRewardedAd(type);
      if (loadPromise) {
        await Promise.race([
          loadPromise,
          new Promise((r) => setTimeout(() => r(false), 2000)),
        ]);
      }
      try {
        ready = await ad.isAdReady().catch(() => false);
      } catch {
        ready = false;
      }
    }

    if (!ready) {
      return {
        success: false,
        error: 'Iklan sponsor gagal dimuat dari server Unity Ads. Silakan periksa jaringan internet kamu.',
      };
    }

    // Tampilkan iklan LevelPlay
    try {
      showCallbacks[type] = {
        onReward,
        onClose,
        isRewarded: false,
      };

      await ad.showAd();
      return { success: true };
    } catch (err) {
      console.warn('[UnityAds] showAd exception:', err);
      showCallbacks[type] = { onReward: null, onClose: null, isRewarded: false };
      return {
        success: false,
        error: err?.message || 'Gagal menampilkan iklan video sponsor.',
      };
    }
  },

  /**
   * Catat pembukaan chapter.
   * Muncul setiap 3 chapter (kelipatan 3x: 3, 6, 9, 12...).
   * Khusus VIP: Bebas iklan.
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

      // Kelipatan 3, 6, 9...
      const shouldShow =
        nextCount > 0 && nextCount % UNITY_ADS_CONFIG.chapterThreshold === 0;

      return {
        shouldShow,
        count: nextCount,
        placementId: UNITY_ADS_CONFIG.chapterUnlockPlacementId,
        appKey: UNITY_ADS_CONFIG.appKey,
        type: 'chapter',
      };
    } catch {
      return { shouldShow: false, count: 0, type: 'chapter' };
    }
  },

  /**
   * Catat aktivitas unduhan chapter.
   * Muncul setiap 3 download (kelipatan 3x: 3, 6, 9, 12...).
   * Khusus VIP: Bebas iklan.
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

      // Kelipatan 3, 6, 9...
      const shouldShow =
        nextCount > 0 && nextCount % UNITY_ADS_CONFIG.downloadThreshold === 0;

      return {
        shouldShow,
        count: nextCount,
        placementId: UNITY_ADS_CONFIG.downloadUnlockPlacementId,
        appKey: UNITY_ADS_CONFIG.appKey,
        type: 'download',
      };
    } catch {
      return { shouldShow: false, count: 0, type: 'download' };
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

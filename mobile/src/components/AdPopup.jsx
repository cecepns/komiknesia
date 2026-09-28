import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image as RNImage,
  StyleSheet,
  Dimensions,
  Linking,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { apiClient, getImageUrl } from '../api/client';
import { useAds } from '../hooks/useAds';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { RADIUS, SPACING } from '../constants/theme';

const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const POPUP_INITIAL_DELAY_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30];
const POPUP_UNLOCK_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const DEFAULT_INITIAL_DELAY_MINUTES = 5;
const DEFAULT_UNLOCK_SECONDS = 10;
const STORAGE_KEY = 'adPopupStateV2';

const sanitizeRedirectUrls = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((url) => /^https?:\/\//i.test(url));
};

// Subtle background stars matching web
const STARS = Array.from({ length: 24 }).map((_, i) => ({
  id: i,
  top: `${(i * 19) % 92 + 4}%`,
  left: `${(i * 29 + (i % 7) * 13) % 92 + 4}%`,
  size: 8 + (i % 4) * 4,
  color: i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#ff2244' : '#dc2626',
  opacity: 0.35 + (i % 5) * 0.12,
}));

const PopupAdCard = ({ ad, onAdClick }) => {
  const [aspectRatio, setAspectRatio] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const imageUrl = getImageUrl(ad?.image);

  useEffect(() => {
    if (!imageUrl) return;
    let isMounted = true;
    RNImage.getSize(
      imageUrl,
      (origWidth, origHeight) => {
        if (isMounted && origWidth && origHeight && origHeight > 0) {
          setAspectRatio(origWidth / origHeight);
        }
      },
      (err) => {
        console.warn('Failed to get popup ad size:', err);
      }
    );
    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  if (!imageUrl) return null;

  // Rasio aspek gambar asli (fallback 16/9 jika belum selesai terukur)
  const cardRatio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onAdClick(ad)}
      style={[
        styles.popupCard,
        {
          aspectRatio: cardRatio,
        },
        !loaded && { minHeight: 180 },
      ]}
    >
      {!loaded && (
        <View style={styles.skeletonPlaceholder}>
          <Ionicons name="megaphone-outline" size={20} color="#4B5563" />
        </View>
      )}
      <Image
        source={{ uri: imageUrl }}
        style={styles.popupImage}
        contentFit="fill"
        cachePolicy="memory-disk"
        onLoad={(e) => {
          setLoaded(true);
          const { width: imgW, height: imgH } = e?.source || {};
          if (imgW && imgH && imgH > 0) {
            setAspectRatio(imgW / imgH);
          }
        }}
      />
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>AD</Text>
      </View>
    </TouchableOpacity>
  );
};

export const AdPopup = () => {
  // Ads popup di mobile di-hide sesuai permintaan
  return null;
};

const _DisabledAdPopup = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { ads, loading } = useAds('popup');

  const [isOpen, setIsOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [countdown, setCountdown] = useState(DEFAULT_UNLOCK_SECONDS);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(10);
  const [initialDelayMinutes, setInitialDelayMinutes] = useState(DEFAULT_INITIAL_DELAY_MINUTES);
  const [unlockSeconds, setUnlockSeconds] = useState(DEFAULT_UNLOCK_SECONDS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [redirectScriptUrls, setRedirectScriptUrls] = useState([]);

  const isOpenRef = useRef(false);
  const fallbackTimingStateRef = useRef(null);

  // Load admin settings
  useEffect(() => {
    apiClient
      .getSettings()
      .then((s) => {
        if (!s) return;
        const interval = s.popup_ads_interval_minutes;
        if (Number.isFinite(interval) && POPUP_INTERVAL_OPTIONS.includes(interval)) {
          setSlotIntervalMinutes(interval);
        }
        const initialDelay = s.popup_ads_initial_delay_minutes;
        if (Number.isFinite(initialDelay) && POPUP_INITIAL_DELAY_OPTIONS.includes(initialDelay)) {
          setInitialDelayMinutes(initialDelay);
        }
        const unlock = s.popup_ads_unlock_seconds;
        if (Number.isFinite(unlock) && POPUP_UNLOCK_SECONDS_OPTIONS.includes(unlock)) {
          setUnlockSeconds(unlock);
        }
        setRedirectScriptUrls(sanitizeRedirectUrls(s?.redirect_script_urls));
      })
      .catch((err) => {
        console.warn('Error fetching ad popup settings:', err);
      })
      .finally(() => setSettingsReady(true));
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const readTimingState = async () => {
    try {
      const stored = await storage.getItem(STORAGE_KEY);
      if (!stored) return fallbackTimingStateRef.current;
      return stored;
    } catch {
      return fallbackTimingStateRef.current;
    }
  };

  const writeTimingState = async (state) => {
    fallbackTimingStateRef.current = state;
    try {
      await storage.setItem(STORAGE_KEY, state);
    } catch (e) {
      console.warn('Error writing ad popup timing state:', e);
    }
  };

  const isMobileVip =
    (Boolean(user?.membership_active || user?.role === 'vip' || user?.role === 'premium')) &&
    (user?.membership_type === 'mobile' || user?.membership_type === 'both');

  // Schedule check loop (runs every second, matching web)
  useEffect(() => {
    if (!settingsReady || !ads.length || loading || isMobileVip) return;

    const UNLOCK_MS = unlockSeconds * 1000;
    const INITIAL_DELAY_MS = initialDelayMinutes * 60 * 1000;

    const checkAndHandleSchedule = async () => {
      try {
        const now = Date.now();
        const intervalMs = slotIntervalMinutes * 60 * 1000;
        let state = await readTimingState();

        if (!state || !Number.isFinite(state.startedAt)) {
          state = {
            startedAt: now,
            lastShownCycle: -1,
          };
          await writeTimingState(state);
        }

        const firstPopupAt = state.startedAt + INITIAL_DELAY_MS;
        if (now < firstPopupAt) {
          if (isOpenRef.current) setIsOpen(false);
          setCanClose(false);
          setCountdown(unlockSeconds);
          return;
        }

        const cycleIndex = Math.floor((now - firstPopupAt) / intervalMs);
        const cycleStartedAt = firstPopupAt + cycleIndex * intervalMs;
        const elapsedMs = now - cycleStartedAt;

        if (state.skippedCycle === cycleIndex) {
          if (isOpenRef.current) setIsOpen(false);
          setCanClose(true);
          setCountdown(0);
          return;
        }

        if (state.lastShownCycle !== cycleIndex) {
          state.lastShownCycle = cycleIndex;
          await writeTimingState(state);
          if (elapsedMs < UNLOCK_MS) {
            const remainingSeconds = Math.max(
              0,
              unlockSeconds - Math.floor(elapsedMs / 1000)
            );
            setIsOpen(true);
            setCanClose(remainingSeconds === 0);
            setCountdown(remainingSeconds);
          } else {
            if (isOpenRef.current) setIsOpen(false);
            setCanClose(false);
            setCountdown(unlockSeconds);
          }
          return;
        }

        if (elapsedMs >= UNLOCK_MS) {
          if (isOpenRef.current) setIsOpen(false);
          setCanClose(true);
          setCountdown(0);
          return;
        }

        const remainingSeconds = Math.max(
          0,
          unlockSeconds - Math.floor(elapsedMs / 1000)
        );

        setIsOpen(true);
        setCanClose(remainingSeconds === 0);
        setCountdown(remainingSeconds);
      } catch (error) {
        console.warn('Error handling ad popup schedule:', error);
      }
    };

    checkAndHandleSchedule();
    const timer = setInterval(checkAndHandleSchedule, 1000);
    return () => clearInterval(timer);
  }, [
    settingsReady,
    ads.length,
    loading,
    user?.membership_active,
    slotIntervalMinutes,
    initialDelayMinutes,
    unlockSeconds,
  ]);

  const markCycleSkipped = async () => {
    try {
      const now = Date.now();
      const intervalMs = slotIntervalMinutes * 60 * 1000;
      const initialDelayMs = initialDelayMinutes * 60 * 1000;
      let state = await readTimingState();

      if (!state || !Number.isFinite(state.startedAt)) {
        state = { startedAt: now, lastShownCycle: -1 };
      }

      const firstPopupAt = state.startedAt + initialDelayMs;
      const cycleIndex = Math.max(0, Math.floor((now - firstPopupAt) / intervalMs));

      await writeTimingState({
        ...state,
        skippedCycle: cycleIndex,
        lastShownCycle: cycleIndex,
      });
    } catch (e) {
      console.warn('Error skipping cycle:', e);
    }
  };

  const handleClose = async () => {
    await markCycleSkipped();
    setIsOpen(false);
  };

  const handleSkipAd = async () => {
    const urls = redirectScriptUrls.length
      ? redirectScriptUrls
      : sanitizeRedirectUrls(['https://mbuh.my.id/siap/1770790072377-komiknesia.js']);

    await markCycleSkipped();
    setIsOpen(false);

    if (urls.length > 0) {
      const randomUrl = urls[Math.floor(Math.random() * urls.length)];
      Linking.openURL(randomUrl).catch(() => {});
    }
  };

  const handlePremiumClick = async () => {
    await markCycleSkipped();
    setIsOpen(false);
    Linking.openURL('https://komiknesia.asia/premium').catch(() => {
      try {
        navigation.navigate('MainTabs', { screen: 'Akun' });
      } catch {}
    });
  };

  const handleAdClick = (ad) => {
    if (ad.link_url) {
      Linking.openURL(ad.link_url).catch(() => {});
    }
  };

  if (!isOpen || !ads.length || isMobileVip) {
    return null;
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={canClose ? handleClose : () => {}}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.fullscreen}>
        {/* Background Dark with Subtle Red Stars */}
        <View style={styles.starsContainer} pointerEvents="none">
          {STARS.map((star) => (
            <View
              key={star.id}
              style={[
                styles.star,
                {
                  top: star.top,
                  left: star.left,
                  opacity: star.opacity,
                },
              ]}
            >
              <Ionicons name="sparkles" size={star.size} color={star.color} />
            </View>
          ))}
        </View>

        {/* Top Control Bar matching web */}
        <View style={styles.headerBar}>
          {/* Left: Countdown box (or Close button when unlocked) */}
          {canClose ? (
            <TouchableOpacity
              style={styles.closeBtnActive}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={14} color="#FFF" />
              <Text style={styles.closeBtnText}>Tutup</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>close in {countdown}</Text>
            </View>
          )}

          {/* Center: Skip Iklan (Red 3D Button) */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkipAd}
            activeOpacity={0.85}
          >
            <Text style={styles.skipBtnText}>Skip Iklan</Text>
          </TouchableOpacity>

          {/* Right: Beli Premium (Gold Gradient Button) */}
          <TouchableOpacity
            onPress={handlePremiumClick}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#F59E0B', '#EAB308', '#F59E0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumBtn}
            >
              <Ionicons name="diamond" size={13} color="#0B0F19" />
              <Text style={styles.premiumBtnText}>Beli Premium</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Scrollable Ads List (1-Grid Layout: single column, full width, no cropping) */}
        <ScrollView
          style={styles.adScrollView}
          contentContainerStyle={styles.adScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.adGridContainer}>
            {ads.map((ad, idx) => (
              <PopupAdCard
                key={ad.id || `popup-ad-${idx}`}
                ad={ad}
                onAdClick={handleAdClick}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  starsContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220, 38, 38, 0.35)',
    zIndex: 30,
  },
  countdownBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(31, 41, 55, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(55, 65, 81, 0.8)',
  },
  countdownText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  closeBtnActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#DC2626',
    gap: 4,
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  skipBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: RADIUS.lg,
    borderBottomWidth: 3,
    borderBottomColor: '#991B1B',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  skipBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  premiumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.lg,
    gap: 4,
    borderBottomWidth: 3,
    borderBottomColor: '#B45309',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  premiumBtnText: {
    color: '#0B0F19',
    fontSize: 12,
    fontWeight: '900',
  },
  adScrollView: {
    flex: 1,
    width: '100%',
  },
  adScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  adGridContainer: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'column', // Single column 1-grid
    gap: SPACING.md,
    alignItems: 'center',
  },
  popupCard: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#121622',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  popupImage: {
    width: '100%',
    height: '100%',
  },
  skeletonPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#151C2C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  adBadge: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 5,
  },
  adBadgeText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

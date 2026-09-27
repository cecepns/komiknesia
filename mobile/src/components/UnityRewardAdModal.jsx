import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { unityAdsService } from '../services/unityAds';

const { width } = Dimensions.get('window');
const REWARD_DURATION = 5; // 5 seconds rewarded ad duration

export const UnityRewardAdModal = ({
  visible,
  type = 'chapter', // 'chapter' | 'download'
  onReward,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(REWARD_DURATION);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const titleText =
    type === 'download'
      ? 'Iklan Reward Unduhan (Kelipatan 3x)'
      : 'Iklan Reward Chapter (Kelipatan 5x)';

  const rewardDescription =
    type === 'download'
      ? 'Tonton hingga selesai untuk mengunduh chapter ke penyimpanan HP.'
      : 'Tonton hingga selesai untuk membuka dan membaca chapter.';

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(REWARD_DURATION);
      setIsCompleted(false);
      progressAnim.setValue(0);
      return;
    }

    let isMounted = true;

    // Coba putar video iklan native Unity LevelPlay secara otomatis
    (async () => {
      try {
        const displayed = await unityAdsService.showNativeRewardedAd(
          type,
          () => {
            if (isMounted && onReward) onReward();
          },
          () => {
            if (isMounted && onClose) onClose();
          }
        );
        if (displayed && isMounted) {
          if (onClose) onClose();
          return;
        }
      } catch (err) {
        console.log('[UnityRewardAdModal] Native ad not ready, using fallback:', err?.message);
      }
    })();

    setSecondsLeft(REWARD_DURATION);
    setIsCompleted(false);
    progressAnim.setValue(0);

    // Animasi progress bar selama durasi reward
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: REWARD_DURATION * 1000,
      useNativeDriver: false,
    }).start();

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [visible, progressAnim, type, onReward, onClose]);

  const handleAttemptClose = () => {
    if (isCompleted) {
      if (onReward) onReward();
      if (onClose) onClose();
      return;
    }

    Alert.alert(
      'Lewati Iklan Reward?',
      'Jika kamu menutup iklan sekarang, reward tidak akan diberikan dan chapter/unduhan tidak akan diproses.',
      [
        { text: 'Lanjut Nonton', style: 'cancel' },
        {
          text: 'Tutup Saja',
          style: 'destructive',
          onPress: () => {
            if (onClose) onClose();
          },
        },
      ]
    );
  };

  const handleClaim = () => {
    if (onReward) onReward();
    if (onClose) onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleAttemptClose}
    >
      <View style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.unityBadge}>
              <Ionicons name="film" size={14} color="#FFF" />
              <Text style={styles.unityBrandText}>IKLAN SPONSOR</Text>
            </View>
          </View>

          <View style={styles.topRightControls}>
            <TouchableOpacity
              style={styles.controlCircle}
              onPress={() => setIsMuted(!isMuted)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={16}
                color="#FFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.closeCircle,
                isCompleted ? styles.closeCircleActive : styles.closeCircleDisabled,
              ]}
              onPress={handleAttemptClose}
              activeOpacity={0.7}
            >
              {isCompleted ? (
                <Ionicons name="close" size={18} color="#FFF" />
              ) : (
                <Text style={styles.countdownNumber}>{secondsLeft}s</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Bar filling */}
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Main Ad Stage */}
        <View style={styles.adStage}>
          <LinearGradient
            colors={['#1E1B4B', '#0F172A', '#020617']}
            style={styles.creativeCard}
          >
            {/* Ambient Graphic Halo */}
            <View style={styles.haloGlow} />

            <View style={styles.graphicIconWrapper}>
              <LinearGradient
                colors={['#6366F1', '#4338CA', '#312E81']}
                style={styles.graphicCircle}
              >
                <Ionicons
                  name={type === 'download' ? 'cloud-download' : 'book'}
                  size={52}
                  color="#FFF"
                />
              </LinearGradient>
            </View>

            <Text style={styles.rewardNoticeTitle}>{titleText}</Text>
            <Text style={styles.rewardNoticeDesc}>{rewardDescription}</Text>

            {/* Sponsor Box (Privasi aman: tidak pernah menampilkan key/placement ke publik) */}
            <View style={styles.sponsorNoticeBox}>
              <Ionicons name="sparkles" size={18} color="#FBBF24" />
              <Text style={styles.sponsorNoticeText}>
                Iklan ini membantu KomikNesia tetap gratis dan update cepat setiap hari. Terima kasih atas dukunganmu!
              </Text>
            </View>

            {/* Status Indicator */}
            {isCompleted ? (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.completedText}>Reward Berhasil Diperoleh!</Text>
              </View>
            ) : (
              <View style={styles.rewardTimerRow}>
                <Ionicons name="timer-outline" size={16} color="#FBBF24" />
                <Text style={styles.timerNoticeText}>
                  Reward dalam <Text style={styles.timerBold}>{secondsLeft} detik</Text>
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Bottom Action Footer */}
        <View style={styles.footerBar}>
          {isCompleted ? (
            <TouchableOpacity
              style={styles.claimBtn}
              activeOpacity={0.85}
              onPress={handleClaim}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.claimBtnGradient}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                <Text style={styles.claimBtnText}>Klaim Reward & Lanjutkan</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.watchingStatusBox}>
              <Text style={styles.watchingStatusText}>
                Menayangkan Iklan Sponsor ({secondsLeft}s)...
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: 48,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A0A0A',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  unityBrandText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeCircleActive: {
    backgroundColor: '#EF4444',
  },
  closeCircleDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  countdownNumber: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  adStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  creativeCard: {
    width: '100%',
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    position: 'relative',
  },
  haloGlow: {
    position: 'absolute',
    top: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  graphicIconWrapper: {
    marginBottom: SPACING.lg,
  },
  graphicCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  rewardNoticeTitle: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  rewardNoticeDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  sponsorNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sponsorNoticeText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  completedText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  rewardTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  timerNoticeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
  },
  timerBold: {
    fontWeight: '800',
    color: '#FDE68A',
  },
  footerBar: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 36,
  },
  claimBtn: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  claimBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  claimBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  watchingStatusBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.lg,
  },
  watchingStatusText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});

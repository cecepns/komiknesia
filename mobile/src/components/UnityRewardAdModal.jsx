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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { UNITY_ADS_CONFIG } from '../services/unityAds';

const { width, height } = Dimensions.get('window');
const REWARD_DURATION = 5; // 5 seconds rewarded ad duration

export const UnityRewardAdModal = ({
  visible,
  type = 'chapter', // 'chapter' | 'download'
  placementId,
  onReward,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(REWARD_DURATION);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentPlacement =
    placementId ||
    (type === 'download'
      ? UNITY_ADS_CONFIG.downloadUnlockPlacementId
      : UNITY_ADS_CONFIG.chapterUnlockPlacementId);

  const titleText =
    type === 'download'
      ? 'Iklan Reward Unduhan (Kelipatan 5x)'
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

    setSecondsLeft(REWARD_DURATION);
    setIsCompleted(false);
    progressAnim.setValue(0);

    // Animate progress bar across 5 seconds
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

    return () => clearInterval(timer);
  }, [visible, progressAnim]);

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
        {/* Top Unity Ads Header Bar */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.unityBadge}>
              <Ionicons name="cube" size={14} color="#FFF" />
              <Text style={styles.unityBrandText}>UNITY ADS</Text>
            </View>
            <View style={styles.placementPill}>
              <Text numberOfLines={1} style={styles.placementPillText}>
                ID: {currentPlacement}
              </Text>
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

        {/* Main Ad Stage / Visual Card */}
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
                  size={56}
                  color="#FFF"
                />
              </LinearGradient>
            </View>

            <Text style={styles.rewardNoticeTitle}>{titleText}</Text>
            <Text style={styles.rewardNoticeDesc}>{rewardDescription}</Text>

            {/* App Key & Info Box */}
            <View style={styles.metaBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>App Key:</Text>
                <Text style={styles.metaVal}>{UNITY_ADS_CONFIG.appKey}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Placement:</Text>
                <Text style={styles.metaVal}>{currentPlacement}</Text>
              </View>
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
                Menayangkan Iklan Unity Ads ({secondsLeft}s)...
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
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 10,
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
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  unityBrandText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  placementPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    maxWidth: 140,
  },
  placementPillText: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '600',
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
    width: 100,
    height: 100,
    borderRadius: 50,
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
    fontSize: 20,
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
  metaBox: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: SPACING.lg,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  metaVal: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  completedText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '800',
  },
  rewardTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  timerNoticeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
  },
  timerBold: {
    fontWeight: '900',
    color: '#FFF',
  },
  footerBar: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 44 : SPACING.xl,
    paddingTop: SPACING.md,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  claimBtn: {
    width: '100%',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  claimBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  claimBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  watchingStatusBox: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  watchingStatusText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});

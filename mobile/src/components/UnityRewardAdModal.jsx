import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { unityAdsService } from '../services/unityAds';

export const UnityRewardAdModal = ({
  visible,
  type = 'chapter', // 'chapter' | 'download'
  onReward,
  onClose,
}) => {
  const [adState, setAdState] = useState('loading'); // 'loading' | 'failed' | 'playing'
  const [errorMessage, setErrorMessage] = useState('');
  const isMountedRef = useRef(true);

  const startAdPlayback = async () => {
    setAdState('loading');
    setErrorMessage('');

    try {
      const res = await unityAdsService.showNativeRewardedAd(
        type,
        () => {
          if (isMountedRef.current && onReward) {
            onReward();
          }
        },
        () => {
          if (isMountedRef.current && onClose) {
            onClose();
          }
        }
      );

      if (!isMountedRef.current) return;

      if (res && res.success) {
        setAdState('playing');
      } else {
        setAdState('failed');
        setErrorMessage(res?.error || 'Iklan gagal dimuat dari server sponsor.');
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setAdState('failed');
      setErrorMessage(err?.message || 'Terjadi kesalahan saat memuat iklan.');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (visible) {
      startAdPlayback();
    } else {
      setAdState('loading');
      setErrorMessage('');
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [visible, type]);

  const handleBypassOrContinue = () => {
    if (onReward) onReward();
    if (onClose) onClose();
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  if (!visible) return null;

  // When native ad is playing, keep the modal invisible/transparent so LevelPlay takes over
  if (adState === 'playing') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {adState === 'loading' ? (
            /* Loading State */
            <View style={styles.contentBox}>
              <View style={styles.iconCircleLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>

              <Text style={styles.title}>Menyiapkan Iklan Sponsor</Text>
              <Text style={styles.description}>
                {type === 'download'
                  ? 'Sedang memuat video reward unduhan chapter...'
                  : 'Sedang memuat video reward chapter...'}
              </Text>

              <View style={styles.badgeRow}>
                <Ionicons name="film" size={13} color="#94A3B8" />
                <Text style={styles.badgeText}>Unity LevelPlay Ads</Text>
              </View>

              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.8}
                onPress={handleClose}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Failed State - As requested: "kalo gagal load ya tampilkan iklan gagal dimuat" */
            <View style={styles.contentBox}>
              <View style={styles.iconCircleError}>
                <Ionicons name="alert-circle" size={48} color="#EF4444" />
              </View>

              <Text style={styles.errorTitle}>Iklan Gagal Dimuat</Text>
              <Text style={styles.errorDescription}>
                {errorMessage ||
                  'Video iklan sponsor gagal dimuat saat ini. Periksa koneksi internet kamu atau coba beberapa saat lagi.'}
              </Text>

              <View style={styles.actionButtonsCol}>
                <TouchableOpacity
                  style={styles.retryBtn}
                  activeOpacity={0.85}
                  onPress={startAdPlayback}
                >
                  <LinearGradient
                    colors={['#DC2626', '#991B1B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btnGradient}
                  >
                    <Ionicons name="refresh" size={16} color="#FFF" />
                    <Text style={styles.retryBtnText}>Coba Lagi</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.continueBtn}
                  activeOpacity={0.85}
                  onPress={handleBypassOrContinue}
                >
                  <Ionicons name="arrow-forward-circle" size={18} color="#10B981" />
                  <Text style={styles.continueBtnText}>
                    {type === 'download' ? 'Lanjutkan Unduhan' : 'Lanjutkan Membaca'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                  onPress={handleClose}
                >
                  <Text style={styles.closeBtnText}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111827',
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: SPACING.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  contentBox: {
    width: '100%',
    alignItems: 'center',
  },
  iconCircleLoading: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  iconCircleError: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  title: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.lg,
  },
  badgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDescription: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xs,
  },
  actionButtonsCol: {
    width: '100%',
    gap: 10,
  },
  retryBtn: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
  },
  continueBtnText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  closeBtnText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
});

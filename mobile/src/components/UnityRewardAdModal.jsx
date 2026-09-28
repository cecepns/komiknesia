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
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { unityAdsService } from '../services/unityAds';

export const UnityRewardAdModal = ({
  visible,
  type = 'chapter', // 'chapter' | 'download'
  onReward,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const isMountedRef = useRef(true);

  const startAdPlayback = async () => {
    setIsPlaying(false);

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
        setIsPlaying(true);
      } else {
        // Jika iklan tidak ada atau gagal dimuat, langsung loloskan tanpa menampilkan popup error
        console.log('[UnityAds] Ad unavailable or failed, continuing directly:', res?.error);
        if (onReward) {
          onReward();
        } else if (onClose) {
          onClose();
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.log('[UnityAds] Ad exception, continuing directly:', err?.message);
      if (onReward) {
        onReward();
      } else if (onClose) {
        onClose();
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (visible) {
      startAdPlayback();
    } else {
      setIsPlaying(false);
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [visible, type]);

  const handleClose = () => {
    if (onClose) onClose();
  };

  if (!visible || isPlaying) return null;

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
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
});

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

const { width } = Dimensions.get('window');

export const ChapterAccessModal = ({
  visible,
  chapter,
  manga,
  onClose,
  onLoginPress,
  onRegisterPress,
}) => {
  if (!visible) return null;

  const chNum = chapter?.number || chapter?.chapter_number || '';
  const mangaTitle = manga?.title || '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              {/* Close Button Top-Right */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Glowing Icon Container */}
              <View style={styles.iconGlowWrapper}>
                <View style={styles.ambientGlow} />
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.iconCircle}
                >
                  <Ionicons name="lock-closed" size={30} color="#FFF" />
                </LinearGradient>
              </View>

              {/* Pill Badge */}
              <View style={styles.badgePill}>
                <Ionicons name="flash" size={11} color="#F59E0B" />
                <Text style={styles.badgePillText}>RILIS TERBARU (&lt; 2 JAM)</Text>
              </View>

              {/* Title & Chapter Details */}
              <Text style={styles.title}>Akses Chapter Terbatas</Text>

              {chNum ? (
                <View style={styles.chapterBadgeRow}>
                  <Text style={styles.chapterBadgeText}>
                    Chapter {chNum}
                  </Text>
                  {mangaTitle ? (
                    <Text numberOfLines={1} style={styles.mangaTitleText}>
                      • {mangaTitle}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Description */}
              <Text style={styles.description}>
                Chapter ini baru saja dirilis dan khusus untuk member KomikNesia. Masuk ke akun kamu untuk langsung membaca sekarang.
              </Text>

              {/* Benefits Box */}
              <View style={styles.benefitsBox}>
                <View style={styles.benefitRow}>
                  <View style={styles.benefitDot}>
                    <Ionicons name="checkmark" size={12} color="#10B981" />
                  </View>
                  <Text style={styles.benefitText}>
                    Baca chapter terbaru tanpa batas waktu tunggu
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <View style={styles.benefitDot}>
                    <Ionicons name="checkmark" size={12} color="#10B981" />
                  </View>
                  <Text style={styles.benefitText}>
                    Simpan riwayat baca & sinkronkan bookmark kamu
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={onLoginPress}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[COLORS.primary, '#B91C1C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Ionicons name="log-in-outline" size={18} color="#FFF" />
                    <Text style={styles.primaryBtnText}>Masuk / Login Sekarang</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {onRegisterPress ? (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={onRegisterPress}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-add-outline" size={16} color="#E5E7EB" />
                    <Text style={styles.secondaryBtnText}>Belum punya akun? Daftar</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Nanti Saja</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: Math.min(width - 40, 360),
    backgroundColor: '#111827',
    borderRadius: RADIUS.xxl,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconGlowWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  ambientGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
  },
  badgePillText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  chapterBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  chapterBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  mangaTitleText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  description: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: SPACING.md,
  },
  benefitsBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 8,
    marginBottom: SPACING.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 15,
  },
  actions: {
    width: '100%',
    gap: SPACING.sm,
  },
  primaryBtn: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12.5,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 11,
    borderRadius: RADIUS.xl,
  },
  secondaryBtnText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelBtnText: {
    color: '#6B7280',
    fontSize: 11.5,
    fontWeight: '600',
  },
});

export default ChapterAccessModal;

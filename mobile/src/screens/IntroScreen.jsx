import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const INTRO_STORAGE_KEY = '@komiknesia_intro_completed';

const SLIDES = [
  {
    id: 1,
    tag: 'PENGALAMAN TERBAIK',
    title: 'Baca Komik,\nTanpa Batas',
    description:
      'Nikmati pengalaman membaca ribuan judul komik favoritmu kapan saja dan di mana saja dengan kualitas gambar jernih, loading super cepat, dan tampilan responsif.',
    badgeIcon: 'book',
    badgeColor: '#EF4444',
    gradient: ['#7F1D1D', '#1E1B4B', '#0B0F19'],
    featuresType: 'simple',
  },
  {
    id: 2,
    tag: 'KATALOG LENGKAP',
    title: 'Ribuan Judul,\nSatu Tempat',
    description:
      'Akses ribuan komik Manga, Manhwa, dan Manhua terpopuler dengan koleksi terlengkap dan terupdate setiap waktu.',
    badgeIcon: 'layers',
    badgeColor: '#F59E0B',
    gradient: ['#78350F', '#1E1B4B', '#0B0F19'],
    featuresType: 'checklist',
    checklist: [
      { id: 'c1', text: 'Update tercepat setiap hari' },
      { id: 'c2', text: 'Akses tanpa iklan untuk premium' },
      { id: 'c3', text: 'Tampilan lengkap & mudah digunakan' },
    ],
  },
  {
    id: 3,
    tag: 'FITUR UNGGULAN',
    title: 'Dunia Komik\ndalam Genggaman',
    description:
      'Temukan, simpan, dan baca komik di mana saja dengan fitur-fitur pintar yang dirancang khusus untuk kenyamanan membaca.',
    badgeIcon: 'phone-portrait',
    badgeColor: '#3B82F6',
    gradient: ['#1E3A8A', '#1E1B4B', '#0B0F19'],
    featuresType: 'points',
    points: [
      {
        id: 'p1',
        icon: 'download-outline',
        color: '#10B981',
        title: 'Mode Baca Offline',
        desc: 'Unduh & simpan chapter langsung ke memori HP',
      },
      {
        id: 'p2',
        icon: 'bookmark-outline',
        color: '#F59E0B',
        title: 'Bookmark & Readlist',
        desc: 'Simpan komik favorit & kelola koleksi bacaan',
      },
      {
        id: 'p3',
        icon: 'speedometer-outline',
        color: '#8B5CF6',
        title: 'Fitur Auto-Scroll',
        desc: 'Membaca otomatis tanpa perlu scroll manual',
      },
    ],
  },
];

export const IntroScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);

  const handleFinishIntro = async () => {
    try {
      await AsyncStorage.setItem(INTRO_STORAGE_KEY, 'true');
    } catch {}
    navigation.replace('MainTabs');
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIdx = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: nextIdx * SCREEN_WIDTH, animated: true });
      setCurrentIndex(nextIdx);
    } else {
      handleFinishIntro();
    }
  };

  const onScrollEnd = (e) => {
    const contentOffset = e.nativeEvent.contentOffset.x;
    const page = Math.round(contentOffset / SCREEN_WIDTH);
    if (page >= 0 && page < SLIDES.length && page !== currentIndex) {
      setCurrentIndex(page);
    }
  };

  const currentSlide = SLIDES[currentIndex];

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={currentSlide.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.8 }}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        {/* Top Header Bar */}
        <View style={styles.topHeader}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />

          {currentIndex < SLIDES.length - 1 ? (
            <TouchableOpacity
              onPress={handleFinishIntro}
              style={styles.skipBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>Lewati</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 50 }} />
          )}
        </View>

        {/* Carousel Content */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={styles.carouselScrollView}
        >
          {SLIDES.map((slide) => (
            <View key={slide.id} style={styles.slidePage}>
              {/* Graphic Stage */}
              <View style={styles.graphicStage}>
                <View
                  style={[
                    styles.haloGlow,
                    { backgroundColor: slide.badgeColor, opacity: 0.15 },
                  ]}
                />

                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.03)']}
                  style={styles.graphicCircle}
                >
                  <Ionicons name={slide.badgeIcon} size={64} color={slide.badgeColor} />
                </LinearGradient>

                <View style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{slide.tag}</Text>
                </View>
              </View>

              {/* Title & Description */}
              <View style={styles.textSection}>
                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideDesc}>{slide.description}</Text>
              </View>

              {/* Slide 2: Checklist */}
              {slide.featuresType === 'checklist' && (
                <View style={styles.checklistCard}>
                  {slide.checklist.map((item) => (
                    <View key={item.id} style={styles.checkItemRow}>
                      <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={13} color="#10B981" />
                      </View>
                      <Text style={styles.checkItemText}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Slide 3: 3 Poin Unggulan */}
              {slide.featuresType === 'points' && (
                <View style={styles.pointsList}>
                  {slide.points.map((p) => (
                    <View key={p.id} style={styles.pointRow}>
                      <View style={[styles.pointIconBox, { backgroundColor: `${p.color}20` }]}>
                        <Ionicons name={p.icon} size={18} color={p.color} />
                      </View>
                      <View style={styles.pointTextCol}>
                        <Text style={styles.pointTitle}>{p.title}</Text>
                        <Text style={styles.pointDesc}>{p.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Bottom Navigation Controls */}
        <View style={styles.bottomControls}>
          {/* Pagination Dots */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => {
              const isActive = idx === currentIndex;
              return (
                <View
                  key={`dot-${idx}`}
                  style={[
                    styles.dot,
                    isActive ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              );
            })}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleNext}
            style={[
              styles.actionBtn,
              currentIndex === SLIDES.length - 1 ? styles.actionBtnFinish : styles.actionBtnNext,
            ]}
          >
            {currentIndex === SLIDES.length - 1 ? (
              <>
                <Text style={styles.actionBtnFinishText}>Mulai Membaca</Text>
                <Ionicons name="rocket-outline" size={18} color="#FFF" />
              </>
            ) : (
              <>
                <Text style={styles.actionBtnNextText}>Lanjut</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    height: 54,
  },
  logoImg: {
    width: 130,
    height: 38,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  skipBtnText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  carouselScrollView: {
    flex: 1,
  },
  slidePage: {
    width: SCREEN_WIDTH,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  graphicStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  haloGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  graphicCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  tagPill: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tagPillText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  textSection: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  slideTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 33,
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  slideDesc: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
  },

  // Slide 2 Checklist
  checklistCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
    marginTop: SPACING.xs,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkItemText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  // Slide 3 Points
  pointsList: {
    width: '100%',
    gap: 10,
    marginTop: SPACING.xs,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  pointIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointTextCol: {
    flex: 1,
  },
  pointTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  pointDesc: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 1,
  },

  // Bottom Controls
  bottomControls: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 26,
    backgroundColor: COLORS.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: RADIUS.xl,
    gap: 8,
  },
  actionBtnNext: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnNextText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  actionBtnFinish: {
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: '#EF4444',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  actionBtnFinishText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});

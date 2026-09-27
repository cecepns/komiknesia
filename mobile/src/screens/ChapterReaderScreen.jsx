import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
  StatusBar,
  Share,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient, getImageUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { isChapterAccessLocked, normalizeChapterImage } from '../utils/chapterAccess';
import { downloadManager } from '../utils/downloadManager';
import { unityAdsService } from '../services/unityAds';
import { UnityRewardAdModal } from '../components/UnityRewardAdModal';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { ChapterItem } from '../components/ChapterItem';
import { AdBanner } from '../components/AdBanner';
import { useAds } from '../hooks/useAds';

const { width } = Dimensions.get('window');

export const ChapterReaderScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { chapterSlug, mangaSlug, mangaTitle } = route.params || {};
  const { isAuthenticated, user } = useAuth();
  const isVip = isAuthenticated && (!!user?.membership_active || user?.role === 'vip') && (!user?.membership_type || user?.membership_type === 'mobile' || user?.membership_type === 'both');

  // Ads mirroring web positions
  const { ads: readerTopAds } = useAds('manga-detail-top');
  const { ads: readerBottomAds } = useAds('manga-detail-bottom');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chapterData, setChapterData] = useState(null);
  const [images, setImages] = useState([]);
  const [isLocked, setIsLocked] = useState(false);

  // Reader Controls Visibility (toggle on tap)
  const [controlsVisible, setControlsVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-scroll
  const [autoScrolling, setAutoScrolling] = useState(false);
  const scrollRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const scrollPosRef = useRef(0);

  const isOfflineMode = !!route.params?.isOffline;
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [unityAdModalVisible, setUnityAdModalVisible] = useState(false);
  const [unityAdType, setUnityAdType] = useState('chapter'); // 'chapter' | 'download'
  const pendingActionRef = useRef(null);

  const fetchChapter = useCallback(async () => {
    if (!chapterSlug) return;
    setLoading(true);
    setError(null);

    // 1. OFFLINE MODE
    if (isOfflineMode) {
      try {
        const offlineData = await downloadManager.getDownloadedChapter(mangaSlug, chapterSlug);
        if (offlineData?.chapter && Array.isArray(offlineData.chapter.images)) {
          setImages(offlineData.chapter.images);
          setChapterData({
            content: {
              title: mangaTitle || offlineData.manga?.title,
              slug: mangaSlug,
            },
            chapters: offlineData.manga?.chapters || [offlineData.chapter],
          });
          setIsLocked(false);
          setIsDownloaded(true);
          setLoading(false);
          return;
        } else {
          throw new Error('Chapter offline tidak ditemukan di penyimpanan HP.');
        }
      } catch (err) {
        setError(err.message || 'Gagal memuat chapter offline');
        setLoading(false);
        return;
      }
    }

    // 2. ONLINE MODE
    try {
      downloadManager.isChapterDownloaded(mangaSlug, chapterSlug).then(setIsDownloaded).catch(() => {});

      const response = await apiClient.getChapterDetail(chapterSlug);
      if (response?.status && response?.data) {
        const data = response.data;
        const chapters = data.chapters || [];
        const locked = isChapterAccessLocked(chapters, chapterSlug, isAuthenticated);

        setIsLocked(locked);
        setChapterData(data);

        if (!locked) {
          const rawImages = data.images || [];
          const normalized = rawImages.map(normalizeChapterImage).filter((img) => !!img.src);
          setImages(normalized);

          // Find current chapter
          const currentIndex = chapters.findIndex((c) => c.slug === chapterSlug);
          const currentChapter = currentIndex >= 0 ? chapters[currentIndex] : null;
          const currentMangaSlug = mangaSlug || data.content?.slug || data.content?.id;

          // Save to reading history
          if (currentChapter) {
            storage.saveHistoryItem({
              mangaSlug: currentMangaSlug,
              mangaTitle: mangaTitle || data.content?.title || 'Komik',
              cover: data.content?.cover || data.content?.image,
              chapterSlug: currentChapter.slug,
              chapterNumber: currentChapter.number || currentChapter.chapter_number,
              chapterTitle: currentChapter.title || null,
            });
          }

          // Record view
          if (currentMangaSlug) {
            apiClient.recordView(currentMangaSlug);
          }

          // Iklan Reward (Kelipatan 5x, bypass for VIP)
          try {
            const adCheck = await unityAdsService.trackChapterRead(isVip);
            if (adCheck?.shouldShow) {
              setUnityAdType('chapter');
              setUnityAdModalVisible(true);
            }
          } catch {}
        }
      } else {
        throw new Error('Gagal memuat isi chapter');
      }
    } catch (err) {
      console.warn('Error reading chapter:', err);
      setError(err.message || 'Gagal memuat chapter');
    } finally {
      setLoading(false);
    }
  }, [chapterSlug, mangaSlug, mangaTitle, isAuthenticated, isOfflineMode]);

  useEffect(() => {
    fetchChapter();
  }, [fetchChapter]);

  // Clean auto-scroll timer on unmount
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, []);

  const toggleAutoScroll = () => {
    if (autoScrolling) {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      setAutoScrolling(false);
    } else {
      setAutoScrolling(true);
      scrollIntervalRef.current = setInterval(() => {
        scrollPosRef.current += 3;
        scrollRef.current?.scrollToOffset({ offset: scrollPosRef.current, animated: false });
      }, 30);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Baca chapter ini di KomikNesia: https://komiknesia.com/view/${chapterSlug}`,
        url: `https://komiknesia.com/view/${chapterSlug}`,
      });
    } catch {
      // ignore
    }
  };

  const allChapters = chapterData?.chapters || [];
  const currentChapterIndex = allChapters.findIndex((c) => c.slug === chapterSlug);
  const currentChapter = currentChapterIndex >= 0 ? allChapters[currentChapterIndex] : null;

  // Next / Previous navigation
  // Note: in chapters list, usually index 0 is newest, index N is oldest
  // So Previous Chapter is index + 1 (lower number), Next Chapter is index - 1 (higher number)
  const prevChapter = currentChapterIndex < allChapters.length - 1 ? allChapters[currentChapterIndex + 1] : null;
  const nextChapter = currentChapterIndex > 0 ? allChapters[currentChapterIndex - 1] : null;

  const navigateToChapter = (targetChapter) => {
    if (!targetChapter) return;
    setDrawerOpen(false);
    if (autoScrolling) toggleAutoScroll();
    navigation.replace('ChapterReader', {
      chapterSlug: targetChapter.slug,
      mangaSlug: mangaSlug || chapterData?.content?.slug,
      mangaTitle: mangaTitle || chapterData?.content?.title,
    });
  };

  const executeDownload = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      const ch = currentChapter || { slug: chapterSlug };
      const m = {
        slug: mangaSlug || chapterData?.content?.slug,
        title: mangaTitle || chapterData?.content?.title,
        cover: chapterData?.content?.cover,
      };

      await downloadManager.downloadChapter({
        manga: m,
        chapter: { ...ch, images },
      });

      setIsDownloaded(true);
      Alert.alert(
        'Unduhan Selesai 🎉',
        `Chapter ${ch.number || ''} berhasil disimpan ke penyimpanan HP dan siap dibaca offline di tab Unduhan.`
      );
    } catch (err) {
      Alert.alert('Gagal Mengunduh', err.message || 'Terjadi kesalahan saat mengunduh chapter.');
    } finally {
      setDownloading(false);
    }
  };

  const checkAdAndDownload = async () => {
    // Iklan Reward (Kelipatan 5x, bypass for VIP)
    const adCheck = await unityAdsService.trackDownload(isVip);
    if (adCheck?.shouldShow) {
      pendingActionRef.current = executeDownload;
      setUnityAdType('download');
      setUnityAdModalVisible(true);
    } else {
      executeDownload();
    }
  };

  const handleDownloadChapter = async () => {
    if (isDownloaded) {
      Alert.alert(
        'Sudah Terunduh',
        'Chapter ini sudah tersimpan di penyimpanan HP. Ingin mengunduh ulang?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Unduh Ulang', onPress: () => checkAdAndDownload() },
        ]
      );
      return;
    }
    checkAdAndDownload();
  };

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Menyiapkan halaman komik...</Text>
      </View>
    );
  }

  if (isLocked) {
    return (
      <SafeAreaView style={styles.lockContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.lockBox}>
          <View style={styles.lockIconCircle}>
            <Ionicons name="lock-closed" size={40} color={COLORS.vip} />
          </View>
          <Text style={styles.lockTitle}>Chapter Terkunci</Text>
          <Text style={styles.lockDesc}>
            Chapter ini baru saja dirilis kurang dari 2 jam yang lalu. Khusus bagi tamu, akses akan terbuka otomatis setelah 2 jam atau masuk ke akun KomikNesia sekarang.
          </Text>
          <TouchableOpacity
            style={styles.lockLoginBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <Ionicons name="log-in-outline" size={18} color="#FFF" />
            <Text style={styles.lockLoginText}>Masuk ke Akun</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.lockBackBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.lockBackText}>Kembali ke Detail</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error || images.length === 0) {
    return (
      <SafeAreaView style={styles.centerLoading}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
        <Text style={styles.errorText}>{error || 'Tidak ada gambar di chapter ini.'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleToggleControls = useCallback(() => {
    setControlsVisible((prev) => !prev);
  }, []);

  const renderReaderItem = useCallback(
    ({ item, index }) => {
      const uri = getImageUrl(item?.src);
      return (
        <ReaderImage
          uri={uri}
          index={index}
          total={images.length}
          onToggleControls={handleToggleControls}
        />
      );
    },
    [images.length, handleToggleControls]
  );

  const renderHeader = useCallback(() => {
    if (readerTopAds.length === 0) return null;
    return (
      <View style={styles.readerAdWrapper}>
        <AdBanner ads={readerTopAds} columns={1} />
      </View>
    );
  }, [readerTopAds]);

  const renderFooter = useCallback(() => {
    return (
      <View style={styles.footerContainer}>
        {readerBottomAds.length > 0 && (
          <View style={styles.readerAdWrapper}>
            <AdBanner ads={readerBottomAds} columns={2} />
          </View>
        )}

        {/* End of chapter action card */}
        <View style={styles.endChapterCard}>
          <Text style={styles.endChapterTitle}>Kamu telah menyelesaikan chapter ini 🎉</Text>
          <View style={styles.endNavButtons}>
            {prevChapter && (
              <TouchableOpacity
                style={styles.endNavBtn}
                onPress={() => navigateToChapter(prevChapter)}
              >
                <Ionicons name="arrow-back" size={16} color="#FFF" />
                <Text style={styles.endNavBtnText}>Chapter Sebelumnya</Text>
              </TouchableOpacity>
            )}
            {nextChapter && (
              <TouchableOpacity
                style={[styles.endNavBtn, styles.endNavBtnPrimary]}
                onPress={() => navigateToChapter(nextChapter)}
              >
                <Text style={styles.endNavBtnText}>Chapter Selanjutnya</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }, [readerBottomAds, prevChapter, nextChapter, navigateToChapter]);

  return (
    <View style={styles.container}>
      <StatusBar hidden={!controlsVisible} barStyle="light-content" backgroundColor="#000000" translucent />

      {/* Top Floating Controls */}
      {controlsVisible && (
        <View
          style={[
            styles.topControlBar,
            {
              paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 14),
              paddingBottom: 12,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.controlCircleBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.topTitleBox}>
            <Text numberOfLines={1} style={styles.topMangaTitle}>
              {mangaTitle || chapterData?.content?.title || 'Komik'}
            </Text>
            <View style={styles.topSubtitleRow}>
              <Text style={styles.topChapterSubtitle}>
                Chapter {currentChapter?.number || currentChapter?.chapter_number || '?'}
              </Text>
              {isOfflineMode && (
                <View style={styles.offlineIndicatorBadge}>
                  <Text style={styles.offlineIndicatorText}>OFFLINE</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.topRightActions}>
            {!isOfflineMode && (
              <TouchableOpacity
                style={styles.controlCircleBtn}
                onPress={handleDownloadChapter}
                disabled={downloading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : isDownloaded ? (
                  <Ionicons name="checkmark-circle" size={19} color="#10B981" />
                ) : (
                  <Ionicons name="cloud-download-outline" size={19} color="#FFF" />
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.controlCircleBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reader Virtualized FlatList Canvas */}
      <FlatList
        ref={scrollRef}
        data={images}
        keyExtractor={(item, index) => `${item?.src || index}-${index}`}
        renderItem={renderReaderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.readerCanvas}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        onScroll={(e) => {
          scrollPosRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={64}
      />

      {/* Bottom Floating Reader Bar */}
      {controlsVisible && (
        <View
          style={[
            styles.bottomControlBar,
            {
              paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 12),
              paddingTop: 12,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.bottomNavBtn, !prevChapter && styles.bottomNavBtnDisabled]}
            disabled={!prevChapter}
            onPress={() => navigateToChapter(prevChapter)}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={prevChapter ? '#FFF' : COLORS.textMuted}
            />
            <Text style={[styles.bottomBtnText, !prevChapter && styles.bottomBtnTextDisabled]}>
              Prev
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomChapterSelector}
            onPress={() => setDrawerOpen(true)}
          >
            <Ionicons name="list" size={16} color={COLORS.primary} />
            <Text style={styles.bottomSelectorText}>
              Ch. {currentChapter?.number || currentChapter?.chapter_number || '?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.autoScrollBtn, autoScrolling && styles.autoScrollBtnActive]}
            onPress={toggleAutoScroll}
          >
            <Ionicons
              name={autoScrolling ? 'pause' : 'play'}
              size={14}
              color={autoScrolling ? '#FFF' : COLORS.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomNavBtn, !nextChapter && styles.bottomNavBtnDisabled]}
            disabled={!nextChapter}
            onPress={() => navigateToChapter(nextChapter)}
          >
            <Text style={[styles.bottomBtnText, !nextChapter && styles.bottomBtnTextDisabled]}>
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={nextChapter ? '#FFF' : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Chapter Selector Modal / Drawer */}
      <Modal
        visible={drawerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerSheet}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Pilih Chapter</Text>
              <TouchableOpacity onPress={() => setDrawerOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={allChapters}
              keyExtractor={(item) => item.slug || String(item.id)}
              renderItem={({ item }) => (
                <ChapterItem
                  chapter={item}
                  isActive={item.slug === chapterSlug}
                  onPress={() => navigateToChapter(item)}
                />
              )}
              contentContainerStyle={styles.drawerListContent}
            />
          </View>
        </View>
      </Modal>

      {/* Unity Rewarded Ad Modal */}
      <UnityRewardAdModal
        visible={unityAdModalVisible}
        type={unityAdType}
        onReward={() => {
          setUnityAdModalVisible(false);
          if (pendingActionRef.current) {
            const action = pendingActionRef.current;
            pendingActionRef.current = null;
            action();
          }
        }}
        onClose={() => {
          setUnityAdModalVisible(false);
          pendingActionRef.current = null;
        }}
      />
    </View>
  );
};

// Module-level ratio cache to remember dimensions across unmount/remount
const ratioCache = new Map();

// Subcomponent for each image with auto-ratio detection and crisp rendering
const ReaderImage = React.memo(({ uri, index, total, onToggleControls }) => {
  const cachedRatio = ratioCache.get(uri);
  const [aspectRatio, setAspectRatio] = useState(cachedRatio || null);
  const [loaded, setLoaded] = useState(!!cachedRatio);
  const [hasError, setHasError] = useState(false);

  const displayHeight = aspectRatio ? width / aspectRatio : width * 1.4;

  return (
    <Pressable
      onPress={onToggleControls}
      style={[styles.imageWrapper, { width, height: displayHeight }]}
    >
      {!loaded && !hasError && (
        <View style={styles.imagePlaceholder}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.imagePlaceholderText}>
            Halaman {index + 1} / {total}
          </Text>
        </View>
      )}
      <Image
        source={{ uri }}
        style={styles.pageImage}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onLoad={(event) => {
          setLoaded(true);
          const w = event?.source?.width;
          const h = event?.source?.height;
          if (w > 0 && h > 0) {
            const r = w / h;
            ratioCache.set(uri, r);
            setAspectRatio(r);
          }
        }}
        onError={() => setHasError(true)}
      />
      {hasError && (
        <View style={styles.imageErrorBox}>
          <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
          <Text style={styles.imageErrorText}>Gagal memuat gambar halaman {index + 1}</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  readerCanvas: {
    backgroundColor: '#000',
    alignItems: 'center',
    paddingBottom: 80,
  },
  readerAdWrapper: {
    width: '100%',
    marginVertical: SPACING.md,
  },
  footerContainer: {
    width: '100%',
    alignItems: 'center',
  },
  imageWrapper: {
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050505',
    gap: 8,
  },
  imagePlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  imageErrorBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    gap: 4,
  },
  imageErrorText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  topControlBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  controlCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitleBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  topMangaTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  topChapterSubtitle: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  bottomControlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  bottomNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 4,
  },
  bottomNavBtnDisabled: {
    opacity: 0.35,
  },
  bottomBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomBtnTextDisabled: {
    color: COLORS.textMuted,
  },
  bottomChapterSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    gap: 6,
  },
  bottomSelectorText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  autoScrollBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  autoScrollBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  endChapterCard: {
    width: width - SPACING.lg * 2,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginVertical: SPACING.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  endChapterTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  endNavButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  endNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  endNavBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  endNavBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '70%',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  drawerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },
  drawerListContent: {
    paddingBottom: SPACING.xl,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: SPACING.sm,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  lockBox: {
    width: '100%',
    backgroundColor: COLORS.surface,
    padding: SPACING.xxl,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  lockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  lockTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  lockDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.xl,
  },
  lockLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    width: '100%',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  lockLoginText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  lockBackBtn: {
    paddingVertical: SPACING.sm,
  },
  lockBackText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    marginVertical: SPACING.md,
  },
  backBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  backBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  topSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlineIndicatorBadge: {
    backgroundColor: '#D97706',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  offlineIndicatorText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

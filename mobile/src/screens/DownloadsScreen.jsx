import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { downloadManager } from '../utils/downloadManager';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export const DownloadsScreen = ({ navigation }) => {
  const [downloadedManga, setDownloadedManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ totalMb: '0 MB', totalChapters: 0 });
  const [expandedManga, setExpandedManga] = useState({});

  const loadDownloads = useCallback(async () => {
    try {
      const [list, storage] = await Promise.all([
        downloadManager.getAllDownloadedManga(),
        downloadManager.getTotalStorageInfo(),
      ]);
      setDownloadedManga(list);
      setStorageInfo(storage);

      // Default expand all if list is short
      if (list.length > 0) {
        const initialExpanded = {};
        list.forEach((m) => {
          initialExpanded[m.slug] = true;
        });
        setExpandedManga(initialExpanded);
      }
    } catch (err) {
      console.warn('Error loading downloads:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
    const unsubscribe = navigation.addListener('focus', () => {
      loadDownloads();
    });
    return unsubscribe;
  }, [navigation, loadDownloads]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDownloads();
  };

  const toggleExpand = (slug) => {
    setExpandedManga((prev) => ({
      ...prev,
      [slug]: !prev[slug],
    }));
  };

  const handleReadOffline = (manga, chapter) => {
    navigation.navigate('ChapterReader', {
      isOffline: true,
      chapterSlug: chapter.slug,
      mangaSlug: manga.slug,
      mangaTitle: manga.title,
    });
  };

  const handleDeleteChapter = (manga, chapter) => {
    Alert.alert(
      'Hapus Unduhan',
      `Hapus Chapter ${chapter.number} dari ${manga.title} dari penyimpanan HP?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await downloadManager.deleteDownloadedChapter(manga.slug, chapter.slug);
            loadDownloads();
          },
        },
      ]
    );
  };

  const handleDeleteAll = () => {
    if (downloadedManga.length === 0) return;
    Alert.alert(
      'Bersihkan Semua Unduhan',
      'Hapus semua chapter komik yang tersimpan di memori HP? Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            await downloadManager.deleteAllDownloads();
            loadDownloads();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="download" size={20} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Unduhan Offline</Text>
        </View>

        {downloadedManga.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleDeleteAll}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
            <Text style={styles.clearBtnText}>Bersihkan</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Storage Banner */}
        <View style={styles.storageBanner}>
          <View style={styles.storageIconBox}>
            <Ionicons name="phone-portrait-outline" size={24} color="#FFF" />
          </View>
          <View style={styles.storageTextBox}>
            <Text style={styles.storageTitle}>Penyimpanan HP</Text>
            <Text style={styles.storageValue}>
              {storageInfo.totalMb} Digunakan • {storageInfo.totalChapters} Chapter
            </Text>
          </View>
          <View style={styles.offlinePill}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlinePillText}>OFFLINE MODE</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Memeriksa berkas offline...</Text>
          </View>
        ) : downloadedManga.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cloud-offline-outline" size={54} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Unduhan</Text>
            <Text style={styles.emptyDesc}>
              Semua chapter komik yang kamu unduh akan tersimpan di penyimpanan internal HP dan dapat dibaca kapan saja tanpa koneksi internet.
            </Text>
            <TouchableOpacity
              style={styles.browseBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Search')}
            >
              <Ionicons name="compass-outline" size={18} color="#FFF" />
              <Text style={styles.browseBtnText}>Cari Komik Menarik</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mangaList}>
            {downloadedManga.map((manga) => {
              const isExpanded = expandedManga[manga.slug] !== false;
              const chapterCount = manga.chapters?.length || 0;

              return (
                <View key={manga.slug} style={styles.mangaCard}>
                  {/* Manga Summary Header */}
                  <TouchableOpacity
                    style={styles.mangaCardHeader}
                    activeOpacity={0.8}
                    onPress={() => toggleExpand(manga.slug)}
                  >
                    <Image
                      source={{ uri: manga.cover }}
                      style={styles.mangaCover}
                      resizeMode="cover"
                    />

                    <View style={styles.mangaInfo}>
                      <Text numberOfLines={1} style={styles.mangaTitle}>
                        {manga.title}
                      </Text>
                      <Text style={styles.mangaMeta}>
                        {chapterCount} Chapter Tersimpan
                      </Text>
                    </View>

                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>

                  {/* Chapters List inside Manga */}
                  {isExpanded && (
                    <View style={styles.chapterList}>
                      {manga.chapters.map((ch) => {
                        const sizeMb = ((ch.sizeBytes || 0) / (1024 * 1024)).toFixed(1);

                        return (
                          <View key={ch.slug} style={styles.chapterItemRow}>
                            <View style={styles.chapterInfo}>
                              <Text numberOfLines={1} style={styles.chapterNumber}>
                                Chapter {ch.number}
                                {ch.title ? ` - ${ch.title}` : ''}
                              </Text>
                              <Text style={styles.chapterSize}>
                                {ch.totalImages || 0} Halaman • {sizeMb} MB
                              </Text>
                            </View>

                            <View style={styles.chapterActions}>
                              <TouchableOpacity
                                style={styles.readOfflineBtn}
                                activeOpacity={0.85}
                                onPress={() => handleReadOffline(manga, ch)}
                              >
                                <Ionicons name="book-outline" size={14} color="#FFF" />
                                <Text style={styles.readOfflineBtnText}>Baca</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.deleteChapterBtn}
                                activeOpacity={0.8}
                                onPress={() => handleDeleteChapter(manga, ch)}
                              >
                                <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.background,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  clearBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl * 2,
  },
  storageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121624',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: SPACING.lg,
  },
  storageIconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storageTextBox: {
    flex: 1,
  },
  storageTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  storageValue: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  offlineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  offlinePillText: {
    color: '#10B981',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  centerLoading: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDesc: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
  },
  browseBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mangaList: {
    gap: SPACING.md,
  },
  mangaCard: {
    backgroundColor: '#131826',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  mangaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  mangaCover: {
    width: 48,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
    marginRight: 12,
  },
  mangaInfo: {
    flex: 1,
  },
  mangaTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  mangaMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  chapterList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  chapterItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  chapterInfo: {
    flex: 1,
    marginRight: 12,
  },
  chapterNumber: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  chapterSize: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  chapterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readOfflineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  readOfflineBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteChapterBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

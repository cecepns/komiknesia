import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { downloadManager } from '../utils/downloadManager';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

// Memoized individual manga download card to prevent unnecessary re-renders when data is large
const MangaDownloadCard = React.memo(
  ({ manga, isExpanded, onToggleExpand, onReadOffline, onDeleteChapter }) => {
    const [showAllChapters, setShowAllChapters] = useState(false);
    const chapters = manga?.chapters || [];
    const displayedChapters = showAllChapters ? chapters : chapters.slice(0, 8);
    const hasMoreChapters = chapters.length > 8;

    return (
      <View style={styles.mangaCard}>
        {/* Manga Summary Header */}
        <TouchableOpacity
          style={styles.mangaCardHeader}
          activeOpacity={0.8}
          onPress={() => onToggleExpand(manga.slug)}
        >
          <Image
            source={{ uri: manga.cover }}
            style={styles.mangaCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />

          <View style={styles.mangaInfo}>
            <Text numberOfLines={1} style={styles.mangaTitle}>
              {manga.title}
            </Text>
            <Text style={styles.mangaMeta}>
              {chapters.length} Chapter Tersimpan
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
            {displayedChapters.map((ch) => {
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
                      onPress={() => onReadOffline(manga, ch)}
                    >
                      <Ionicons name="book-outline" size={14} color="#FFF" />
                      <Text style={styles.readOfflineBtnText}>Baca</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteChapterBtn}
                      activeOpacity={0.8}
                      onPress={() => onDeleteChapter(manga, ch)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {hasMoreChapters && (
              <TouchableOpacity
                style={styles.showMoreBtn}
                onPress={() => setShowAllChapters(!showAllChapters)}
                activeOpacity={0.8}
              >
                <Text style={styles.showMoreText}>
                  {showAllChapters
                    ? 'Sembunyikan sebagian chapter'
                    : `Lihat ${chapters.length - 8} chapter lainnya...`}
                </Text>
                <Ionicons
                  name={showAllChapters ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }
);

export const DownloadsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [downloadedManga, setDownloadedManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ totalMb: '0 MB', totalChapters: 0 });
  const [expandedManga, setExpandedManga] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const loadDownloads = useCallback(async () => {
    try {
      const [list, storage] = await Promise.all([
        downloadManager.getAllDownloadedManga(),
        downloadManager.getTotalStorageInfo(),
      ]);
      setDownloadedManga(list);
      setStorageInfo(storage);

      // Default expand: if only 1 manga, expand it. If multiple, only expand first item to keep load instant.
      if (list.length > 0) {
        setExpandedManga((prev) => {
          if (Object.keys(prev).length > 0) return prev; // Preserve user's toggle state
          const initialExpanded = {};
          list.forEach((m, idx) => {
            initialExpanded[m.slug] = idx === 0;
          });
          return initialExpanded;
        });
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

  const toggleExpand = useCallback((slug) => {
    setExpandedManga((prev) => ({
      ...prev,
      [slug]: !prev[slug],
    }));
  }, []);

  const handleExpandAll = useCallback(() => {
    const all = {};
    downloadedManga.forEach((m) => {
      all[m.slug] = true;
    });
    setExpandedManga(all);
  }, [downloadedManga]);

  const handleCollapseAll = useCallback(() => {
    const all = {};
    downloadedManga.forEach((m) => {
      all[m.slug] = false;
    });
    setExpandedManga(all);
  }, [downloadedManga]);

  const handleReadOffline = useCallback(
    (manga, chapter) => {
      navigation.navigate('ChapterReader', {
        isOffline: true,
        chapterSlug: chapter.slug,
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
      });
    },
    [navigation]
  );

  const handleDeleteChapter = useCallback(
    (manga, chapter) => {
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
    },
    [loadDownloads]
  );

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

  // Filter manga list when searching
  const filteredManga = useMemo(() => {
    if (!searchQuery.trim()) return downloadedManga;
    const q = searchQuery.toLowerCase().trim();
    return downloadedManga.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.chapters?.some((c) => String(c.number).includes(q) || c.title?.toLowerCase().includes(q))
    );
  }, [downloadedManga, searchQuery]);

  const renderMangaCard = useCallback(
    ({ item }) => (
      <MangaDownloadCard
        manga={item}
        isExpanded={expandedManga[item.slug] !== false}
        onToggleExpand={toggleExpand}
        onReadOffline={handleReadOffline}
        onDeleteChapter={handleDeleteChapter}
      />
    ),
    [expandedManga, toggleExpand, handleReadOffline, handleDeleteChapter]
  );

  const renderHeader = useCallback(() => {
    return (
      <View>
        {/* Storage Banner */}
        <View style={styles.storageBanner}>
          <View style={styles.storageIconBox}>
            <Ionicons name="phone-portrait-outline" size={22} color="#FFF" />
          </View>
          <View style={styles.storageTextBox}>
            <Text style={styles.storageTitle}>Penyimpanan HP</Text>
            <Text style={styles.storageValue}>
              {storageInfo.totalMb} Digunakan • {storageInfo.totalChapters} Chapter ({downloadedManga.length} Komik)
            </Text>
          </View>
          <View style={styles.offlinePill}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlinePillText}>OFFLINE MODE</Text>
          </View>
        </View>

        {/* Search Input when manga count > 2 */}
        {downloadedManga.length > 2 && (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={17} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari komik atau chapter terunduh..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bulk Expand / Collapse buttons when list > 1 */}
        {downloadedManga.length > 1 && (
          <View style={styles.bulkRow}>
            <Text style={styles.mangaCountText}>
              {filteredManga.length} Komik Tersedia
            </Text>
            <View style={styles.bulkActions}>
              <TouchableOpacity
                onPress={handleExpandAll}
                style={styles.bulkBtn}
              >
                <Text style={styles.bulkBtnText}>Buka Semua</Text>
              </TouchableOpacity>
              <Text style={styles.bulkDot}>•</Text>
              <TouchableOpacity
                onPress={handleCollapseAll}
                style={styles.bulkBtn}
              >
                <Text style={styles.bulkBtnText}>Tutup Semua</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }, [
    storageInfo,
    downloadedManga.length,
    searchQuery,
    filteredManga.length,
    handleExpandAll,
    handleCollapseAll,
  ]);

  const renderEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Memeriksa berkas offline...</Text>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={44} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Tidak Ditemukan</Text>
          <Text style={styles.emptyDesc}>
            Tidak ada komik terunduh yang cocok dengan "{searchQuery}".
          </Text>
        </View>
      );
    }

    return (
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
    );
  }, [loading, searchQuery, navigation]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Top Header with solid #000000 */}
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

      {/* Virtualized FlatList for large download datasets */}
      <FlatList
        data={filteredManga}
        keyExtractor={(item) => item.slug || String(item.id)}
        renderItem={renderMangaCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + SPACING.xxxl * 2 },
        ]}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#000000',
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
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
  },
  storageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: SPACING.md,
  },
  storageIconBox: {
    width: 42,
    height: 42,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: SPACING.md,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  bulkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  mangaCountText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  bulkBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  bulkDot: {
    color: COLORS.textMuted,
    fontSize: 10,
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
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
  mangaCard: {
    backgroundColor: '#111111',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: SPACING.md,
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
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#090909',
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 6,
    backgroundColor: '#0D0D0D',
  },
  showMoreText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});

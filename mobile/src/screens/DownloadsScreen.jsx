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
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { downloadManager } from '../utils/downloadManager';
import { getImageUrl } from '../api/client';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

// Helper to format total chapter bytes into human readable MB / GB
const formatTotalSize = (chapters = []) => {
  const bytes = chapters.reduce((sum, ch) => sum + (ch.sizeBytes || 0), 0);
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Bookmark-style Manga Card (matching LibraryScreen 2-column grid)
const DownloadedMangaCard = React.memo(({ manga, onPress, onDelete }) => {
  const coverUrl = getImageUrl(manga.cover);
  const chaptersCount = manga.chapters?.length || 0;
  const totalSize = useMemo(() => formatTotalSize(manga.chapters), [manga.chapters]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(manga)}
      style={styles.gridCard}
    >
      <View style={styles.gridCardCoverWrapper}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.gridCardCover}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.placeholderCover}>
            <Ionicons name="book-outline" size={26} color={COLORS.textMuted} />
          </View>
        )}

        {/* Floating Delete Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onDelete(manga)}
          style={styles.floatingDeleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={13} color="#EF4444" />
        </TouchableOpacity>

        {/* Floating Chapter Badge */}
        <View style={styles.floatingChapterBadge}>
          <Text style={styles.floatingChapterText}>{chaptersCount} Ch</Text>
        </View>
      </View>

      <View style={styles.gridCardBody}>
        <Text numberOfLines={2} style={styles.gridCardTitle}>
          {manga.title || 'Tanpa Judul'}
        </Text>
        <Text style={styles.gridCardMeta}>{totalSize}</Text>
      </View>
    </TouchableOpacity>
  );
});

DownloadedMangaCard.displayName = 'DownloadedMangaCard';

export const DownloadsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [downloadedManga, setDownloadedManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManga, setSelectedManga] = useState(null);

  const loadDownloads = useCallback(async () => {
    try {
      const list = await downloadManager.getAllDownloadedManga();
      setDownloadedManga(list);

      // Keep selectedManga in sync if modal is open
      setSelectedManga((prev) => {
        if (!prev) return null;
        const updated = list.find((m) => m.slug === prev.slug);
        return updated || null;
      });
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

  const handleReadOffline = useCallback(
    (manga, chapter) => {
      setSelectedManga(null);
      navigation.navigate('ChapterReader', {
        isOffline: true,
        chapterSlug: chapter.slug,
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
      });
    },
    [navigation]
  );

  const handleDeleteManga = useCallback(
    (manga) => {
      const chaptersCount = manga.chapters?.length || 0;
      Alert.alert(
        'Hapus Unduhan',
        `Hapus seluruh unduhan "${manga.title}" (${chaptersCount} chapter) dari penyimpanan HP?`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Hapus',
            style: 'destructive',
            onPress: async () => {
              await downloadManager.deleteDownloadedManga(manga.slug);
              if (selectedManga?.slug === manga.slug) {
                setSelectedManga(null);
              }
              loadDownloads();
            },
          },
        ]
      );
    },
    [selectedManga, loadDownloads]
  );

  const handleDeleteChapter = useCallback(
    (manga, chapter) => {
      Alert.alert(
        'Hapus Chapter',
        `Hapus Chapter ${chapter.number} dari "${manga.title}" dari penyimpanan HP?`,
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
            setSelectedManga(null);
            loadDownloads();
          },
        },
      ]
    );
  };

  // Filter manga list by search query (matching manga title or chapter number/title)
  const filteredManga = useMemo(() => {
    if (!searchQuery.trim()) return downloadedManga;
    const q = searchQuery.toLowerCase().trim();
    return downloadedManga.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.chapters?.some(
          (c) =>
            String(c.number).toLowerCase().includes(q) ||
            (c.title && c.title.toLowerCase().includes(q))
        )
    );
  }, [downloadedManga, searchQuery]);

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
            {`Tidak ada komik terunduh yang cocok dengan "${searchQuery}".`}
          </Text>
          <TouchableOpacity
            style={styles.resetSearchBtn}
            onPress={() => setSearchQuery('')}
            activeOpacity={0.8}
          >
            <Text style={styles.resetSearchText}>Hapus Pencarian</Text>
          </TouchableOpacity>
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
          Semua chapter komik yang kamu unduh dapat dibaca kapan saja tanpa koneksi internet.
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

      {/* Prominent Search Bar (visible when there are downloads) */}
      {downloadedManga.length > 0 && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={17} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari komik terunduh..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 2-Column Grid (Bookmark Style) */}
      <FlatList
        data={filteredManga}
        key="downloads-grid"
        keyExtractor={(item) => item.slug || String(item.id)}
        numColumns={2}
        columnWrapperStyle={filteredManga.length > 0 ? styles.columnWrapper : undefined}
        renderItem={({ item }) => (
          <DownloadedMangaCard
            manga={item}
            onPress={setSelectedManga}
            onDelete={handleDeleteManga}
          />
        )}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          filteredManga.length === 0 && styles.emptyListGrow,
          { paddingBottom: Math.max(insets.bottom, 24) + SPACING.xxxl * 2 },
        ]}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
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

      {/* Modal Daftar Chapter Terunduh */}
      <Modal
        visible={!!selectedManga}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedManga(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedManga(null)}
          />
          <View style={styles.modalCard}>
            {/* Header info */}
            <View style={styles.modalHeader}>
              <Image
                source={{ uri: getImageUrl(selectedManga?.cover) }}
                style={styles.modalCover}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <View style={styles.modalHeaderInfo}>
                <Text numberOfLines={2} style={styles.modalTitle}>
                  {selectedManga?.title}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedManga?.chapters?.length || 0} Chapter Tersimpan •{' '}
                  {formatTotalSize(selectedManga?.chapters)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedManga(null)}
                style={styles.modalCloseCircle}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Quick Action: Mulai Baca */}
            {selectedManga?.chapters?.length > 0 && (
              <TouchableOpacity
                style={styles.modalQuickReadBtn}
                activeOpacity={0.85}
                onPress={() => {
                  const targetChapter =
                    selectedManga.chapters[selectedManga.chapters.length - 1] ||
                    selectedManga.chapters[0];
                  handleReadOffline(selectedManga, targetChapter);
                }}
              >
                <Ionicons name="play" size={14} color="#FFF" />
                <Text style={styles.modalQuickReadText}>
                  Mulai Baca (Chapter{' '}
                  {selectedManga.chapters[selectedManga.chapters.length - 1]?.number ||
                    selectedManga.chapters[0]?.number}
                  )
                </Text>
              </TouchableOpacity>
            )}

            {/* Chapter List */}
            <FlatList
              data={selectedManga?.chapters || []}
              keyExtractor={(ch) => ch.slug}
              style={styles.modalChapterList}
              showsVerticalScrollIndicator={true}
              renderItem={({ item: ch }) => {
                const sizeMb = ((ch.sizeBytes || 0) / (1024 * 1024)).toFixed(1);

                return (
                  <TouchableOpacity
                    style={styles.modalChapterRow}
                    activeOpacity={0.8}
                    onPress={() => handleReadOffline(selectedManga, ch)}
                  >
                    <View style={styles.modalChapterInfo}>
                      <Text numberOfLines={1} style={styles.modalChapterNumber}>
                        Chapter {ch.number}
                        {ch.title ? ` - ${ch.title}` : ''}
                      </Text>
                      <Text style={styles.modalChapterMeta}>
                        {ch.totalImages || 0} Halaman • {sizeMb} MB
                      </Text>
                    </View>

                    <View style={styles.modalChapterActions}>
                      <View style={styles.modalReadBtn}>
                        <Ionicons name="book-outline" size={12} color="#FFF" />
                        <Text style={styles.modalReadBtnText}>Baca</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.modalDeleteBtn}
                        activeOpacity={0.8}
                        onPress={() => handleDeleteChapter(selectedManga, ch)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    backgroundColor: '#000000',
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
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  emptyListGrow: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridCardCoverWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#0F121C',
    position: 'relative',
  },
  gridCardCover: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F121C',
  },
  floatingDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  floatingChapterBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    zIndex: 5,
  },
  floatingChapterText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  gridCardBody: {
    padding: 8,
  },
  gridCardTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  gridCardMeta: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 4,
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
  resetSearchBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginTop: 10,
  },
  resetSearchText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Chapter Selection Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: '#111522',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '80%',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: 12,
  },
  modalCover: {
    width: 44,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: '#0F121C',
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalQuickReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  modalQuickReadText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalChapterList: {
    maxHeight: 360,
  },
  modalChapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalChapterInfo: {
    flex: 1,
    marginRight: 10,
  },
  modalChapterNumber: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  modalChapterMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  modalChapterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  modalReadBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

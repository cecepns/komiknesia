import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../api/client';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { MangaCard } from '../components/MangaCard';
import { SearchInput } from '../components/SearchInput';
import { CategoryPill } from '../components/CategoryPill';
import { EmptyState } from '../components/EmptyState';
import { useAds } from '../hooks/useAds';
import { useAuth } from '../contexts/AuthContext';
import { ChapterAccessModal } from '../components/ChapterAccessModal';
import { requiresChapterLogin } from '../utils/chapterAccess';

const TYPE_OPTIONS = ['All', 'Manhwa', 'Manga', 'Manhua'];
const STATUS_OPTIONS = ['All', 'Ongoing', 'Completed'];
const ORDER_OPTIONS = [
  { label: 'Update', value: 'Update' },
  { label: 'Populer', value: 'Popular' },
  { label: 'A - Z', value: 'Az' },
  { label: 'Z - A', value: 'Za' },
  { label: 'Terbaru', value: 'Added' },
];

export const ExploreScreen = ({ navigation, route }) => {
  const { isAuthenticated } = useAuth();
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [lockedChapterInfo, setLockedChapterInfo] = useState({ chapter: null, manga: null });

  const [searchQuery, setSearchQuery] = useState(route?.params?.query || '');
  const [debouncedQuery, setDebouncedQuery] = useState(route?.params?.query || '');
  const [selectedType, setSelectedType] = useState(route?.params?.filterType || 'All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState(route?.params?.filterOrder || 'Update');
  const [selectedProject, setSelectedProject] = useState(route?.params?.filterProject || 'all');

  // Sync route params when navigating
  useEffect(() => {
    if (route?.params?.filterType) {
      setSelectedType(route.params.filterType);
    }
    if (route?.params?.filterProject) {
      setSelectedProject(route.params.filterProject);
    }
    if (route?.params?.filterOrder) {
      setSelectedOrder(route.params.filterOrder);
    }
    if (route?.params?.query !== undefined) {
      setSearchQuery(route.params.query);
      setDebouncedQuery(route.params.query);
    }
  }, [route?.params]);

  // Genres
  const [genres, setGenres] = useState([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState(new Set());
  const [showGenreModal, setShowGenreModal] = useState(false);

  // Manga list & pagination
  const [mangaList, setMangaList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Ads mirroring web positions
  const { ads: comicTopAds } = useAds('comic-top');
  const { ads: comicFooterAds } = useAds('comic-footer');

  // Debounce search input
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(text);
      setPage(1);
    }, 450);
  };

  // Load genres
  useEffect(() => {
    apiClient
      .getGenres()
      .then((res) => {
        if (res?.status && Array.isArray(res.data)) {
          setGenres(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch manga items
  const fetchManga = useCallback(
    async (pageNumber = 1, isRefresh = false) => {
      if (pageNumber === 1 && !isRefresh) {
        setLoading(true);
      } else if (pageNumber > 1) {
        setLoadingMore(true);
      }

      try {
        const params = {
          page: pageNumber,
          per_page: 18,
          q: debouncedQuery.trim() || undefined,
          type: selectedType !== 'All' ? selectedType : undefined,
          status: selectedStatus !== 'All' ? selectedStatus : undefined,
          orderBy: selectedOrder,
          project: selectedProject !== 'all' ? selectedProject : undefined,
        };

        if (selectedGenreIds.size > 0) {
          params.genreId = Array.from(selectedGenreIds);
        }

        const response = await apiClient.getContents(params);
        if (response?.status && Array.isArray(response.data)) {
          if (pageNumber === 1) {
            setMangaList(response.data);
          } else {
            setMangaList((prev) => [...prev, ...response.data]);
          }

          if (response.pagination?.total_pages) {
            setTotalPages(response.pagination.total_pages);
          }
        }
      } catch (err) {
        console.warn('Error fetching contents:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [debouncedQuery, selectedType, selectedStatus, selectedOrder, selectedProject, selectedGenreIds]
  );

  useEffect(() => {
    setPage(1);
    fetchManga(1);
  }, [fetchManga]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchManga(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && page < totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchManga(nextPage);
    }
  };

  const handleMangaPress = (manga) => {
    const slug = manga.slug || manga.id;
    if (slug) {
      navigation.navigate('MangaDetail', { slug, title: manga.title });
    }
  };

  const handleChapterPress = (chapter, manga) => {
    if (!chapter?.slug) {
      handleMangaPress(manga);
      return;
    }

    if (requiresChapterLogin(chapter, isAuthenticated)) {
      setLockedChapterInfo({ chapter, manga });
      setAccessModalVisible(true);
      return;
    }

    navigation.navigate('ChapterReader', {
      chapterSlug: chapter.slug,
      mangaSlug: manga?.slug || manga?.id,
      mangaTitle: manga?.title || '',
    });
  };

  const toggleGenre = (genreId) => {
    setSelectedGenreIds((prev) => {
      const next = new Set(prev);
      if (next.has(genreId)) {
        next.delete(genreId);
      } else {
        next.add(genreId);
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setSelectedType('All');
    setSelectedStatus('All');
    setSelectedOrder('Update');
    setSelectedProject('all');
    setSelectedGenreIds(new Set());
    setSearchQuery('');
    setDebouncedQuery('');
  };

  const hasActiveFilters =
    selectedType !== 'All' ||
    selectedStatus !== 'All' ||
    selectedOrder !== 'Update' ||
    selectedProject !== 'all' ||
    selectedGenreIds.size > 0 ||
    !!debouncedQuery;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header & Search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Katalog Komik</Text>
        <SearchInput
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Cari manga, manhwa, manhua..."
          onClear={() => {
            setSearchQuery('');
            setDebouncedQuery('');
          }}
        />
      </View>

      {/* Filter Horizontal Bar */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPills}
        >
          {/* Genre Button with badge */}
          <TouchableOpacity
            style={[
              styles.genreFilterBtn,
              selectedGenreIds.size > 0 && styles.genreFilterBtnActive,
            ]}
            onPress={() => setShowGenreModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={14}
              color={selectedGenreIds.size > 0 ? '#FFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.genreFilterBtnText,
                selectedGenreIds.size > 0 && styles.genreFilterBtnTextActive,
              ]}
            >
              Genre {selectedGenreIds.size > 0 ? `(${selectedGenreIds.size})` : ''}
            </Text>
          </TouchableOpacity>

          {/* Type filters */}
          {TYPE_OPTIONS.map((t) => (
            <CategoryPill
              key={t}
              label={t === 'All' ? 'Semua Tipe' : t}
              active={selectedType === t}
              onPress={() => setSelectedType(t)}
            />
          ))}

          {/* Status filters */}
          {STATUS_OPTIONS.map((s) => (
            <CategoryPill
              key={s}
              label={s === 'All' ? 'Semua Status' : s}
              active={selectedStatus === s}
              onPress={() => setSelectedStatus(s)}
            />
          ))}

          {/* Order filters */}
          {ORDER_OPTIONS.map((o) => (
            <CategoryPill
              key={o.value}
              label={o.label}
              active={selectedOrder === o.value}
              onPress={() => setSelectedOrder(o.value)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Comic Grid */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Memuat komik...</Text>
        </View>
      ) : mangaList.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Tidak Ada Komik Ditemukan"
          description="Coba ubah kata kunci pencarian atau reset filter yang dipilih."
          buttonText={hasActiveFilters ? 'Reset Semua Filter' : undefined}
          onButtonPress={clearAllFilters}
        />
      ) : (
        <FlatList
          data={mangaList}
          keyExtractor={(item, idx) => `${item.id || item.slug}-${idx}`}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <MangaCard
              manga={item}
              columns={2}
              showLastChapters={true}
              isAuthenticated={isAuthenticated}
              onPress={handleMangaPress}
              onChapterPress={handleChapterPress}
            />
          )}
          ListHeaderComponent={
            comicTopAds.length > 0 ? (
              <AdBanner ads={comicTopAds} columns={2} style={styles.topAd} />
            ) : null
          }
          ListFooterComponent={
            <View>
              {loadingMore && (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.footerLoaderText}>Memuat lebih banyak...</Text>
                </View>
              )}
              {comicFooterAds.length > 0 && (
                <AdBanner ads={comicFooterAds} columns={2} style={styles.footerAd} />
              )}
            </View>
          }
        />
      )}

      {/* Genre Picker Modal */}
      <Modal
        visible={showGenreModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowGenreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Genre</Text>
              <TouchableOpacity
                onPress={() => setShowGenreModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.genreChipsContainer}
              showsVerticalScrollIndicator={false}
            >
              {genres.map((g) => {
                const isSelected = selectedGenreIds.has(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    activeOpacity={0.7}
                    onPress={() => toggleGenre(g.id)}
                    style={[
                      styles.genreChip,
                      isSelected && styles.genreChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.genreChipText,
                        isSelected && styles.genreChipTextActive,
                      ]}
                    >
                      {g.name || g.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={() => setSelectedGenreIds(new Set())}
              >
                <Text style={styles.modalResetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => setShowGenreModal(false)}
              >
                <Text style={styles.modalApplyBtnText}>Terapkan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Modal Akses Terbatas */}
      <ChapterAccessModal
        visible={accessModalVisible}
        chapter={lockedChapterInfo.chapter}
        manga={lockedChapterInfo.manga}
        onClose={() => setAccessModalVisible(false)}
        onLoginPress={() => {
          setAccessModalVisible(false);
          navigation.navigate('Login');
        }}
        onRegisterPress={() => {
          setAccessModalVisible(false);
          navigation.navigate('Register');
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topAd: {
    marginVertical: SPACING.sm,
  },
  footerAd: {
    marginVertical: SPACING.md,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  filtersWrapper: {
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  filterPills: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    gap: 4,
  },
  genreFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 6,
    marginRight: SPACING.sm,
  },
  genreFilterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genreFilterBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  genreFilterBtnTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: SPACING.sm,
  },
  footerLoader: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  footerLoaderText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surfaceElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '75%',
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  genreChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  genreChip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  genreChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genreChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  genreChipTextActive: {
    color: '#FFF',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  modalResetBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalResetBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  modalApplyBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  modalApplyBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});

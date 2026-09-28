import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient, getImageUrl } from '../api/client';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { MangaCard } from '../components/MangaCard';
import { SearchInput } from '../components/SearchInput';
import { EmptyState } from '../components/EmptyState';
import { useAds } from '../hooks/useAds';
import { useAuth } from '../contexts/AuthContext';
import { ChapterAccessModal } from '../components/ChapterAccessModal';
import { requiresChapterLogin } from '../utils/chapterAccess';
import { timeAgo } from '../utils/timeAgo';

const { width } = Dimensions.get('window');

// 1. Filter Definitions matching src/pages/Content.jsx
const STATUS_OPTIONS = ['All', 'Ongoing', 'Completed', 'Hiatus'];

const TYPE_OPTIONS = [
  { label: 'All', value: 'All', apiType: null },
  { label: 'Comic', value: 'Comic', apiType: 'comic' },
  { label: 'Manga', value: 'Manga', apiType: 'manga' },
  { label: 'Manhua', value: 'Manhua', apiType: 'manhua' },
  { label: 'Manhwa', value: 'Manhwa', apiType: 'manhwa' },
];

const ORDER_OPTIONS = [
  { label: 'Update', value: 'Update' },
  { label: 'Populer', value: 'Popular' },
  { label: 'A - Z', value: 'Az' },
  { label: 'Z - A', value: 'Za' },
  { label: 'Terbaru', value: 'Added' },
];

const PROJECT_OPTIONS = [
  { label: 'Semua', value: 'all' },
  { label: 'Project', value: 'true' },
  { label: 'Bukan project', value: 'false' },
];

const SOURCE_OPTIONS = [
  { label: 'Semua Source', value: 'all' },
  { label: 'Source 1', value: 'kiryu' },
  { label: 'Source 2', value: 'apkomik' },
];

export const ExploreScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const modalBottomInset = Math.max(
    insets.bottom || 0,
    Platform.OS === 'android' ? 24 : 16
  );
  const { isAuthenticated } = useAuth();
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [lockedChapterInfo, setLockedChapterInfo] = useState({ chapter: null, manga: null });

  // Search
  const [searchQuery, setSearchQuery] = useState(route?.params?.query || '');
  const [debouncedQuery, setDebouncedQuery] = useState(route?.params?.query || '');

  // Active Filters matching Content.jsx
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedType, setSelectedType] = useState(route?.params?.filterType || 'All');
  const [selectedOrder, setSelectedOrder] = useState(route?.params?.filterOrder || 'Update');
  const [selectedProject, setSelectedProject] = useState(route?.params?.filterProject || 'all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedGenreIds, setSelectedGenreIds] = useState(new Set());

  // View Mode: 'grid' | 'list'
  const [viewMode, setViewMode] = useState('grid');

  // Filter Modal
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [genreSearchInput, setGenreSearchInput] = useState('');

  // Genres from API
  const [genres, setGenres] = useState([]);
  const [genresLoading, setGenresLoading] = useState(false);

  // Manga list & Pagination
  const [mangaList, setMangaList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const flatListRef = useRef(null);

  // Ads
  const { ads: comicTopAds } = useAds('comic-top');
  const { ads: comicFooterAds } = useAds('comic-footer');

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

  // Load genres from /contents/genres
  useEffect(() => {
    setGenresLoading(true);
    apiClient
      .getGenres()
      .then((res) => {
        if (res?.status && Array.isArray(res.data)) {
          setGenres(res.data);
        }
      })
      .catch((err) => {
        console.warn('Error fetching genres:', err);
      })
      .finally(() => {
        setGenresLoading(false);
      });
  }, []);

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

  // Active filter count calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedStatus !== 'All') count++;
    if (selectedType !== 'All') count++;
    if (selectedProject !== 'all') count++;
    if (selectedSource !== 'all') count++;
    if (selectedOrder !== 'Update') count++;
    if (selectedGenreIds.size > 0) count += selectedGenreIds.size;
    return count;
  }, [selectedStatus, selectedType, selectedProject, selectedSource, selectedOrder, selectedGenreIds]);

  // Fetch manga items from API with pagination
  const fetchManga = useCallback(
    async (pageNumber = 1, isRefresh = false) => {
      if (!isRefresh) setLoading(true);

      try {
        const typeObj = TYPE_OPTIONS.find((t) => t.value === selectedType);
        const apiTypeValue = typeObj?.apiType || (selectedType !== 'All' ? selectedType.toLowerCase() : undefined);

        const params = {
          page: pageNumber,
          per_page: 24, // 24 items matching Content.jsx web
          q: debouncedQuery.trim() || undefined,
          type: apiTypeValue,
          status: selectedStatus !== 'All' ? selectedStatus : undefined,
          orderBy: selectedOrder,
          project: selectedProject !== 'all' ? selectedProject : undefined,
          source: selectedSource !== 'all' ? selectedSource : undefined,
        };

        if (selectedGenreIds.size > 0) {
          params.genre = Array.from(selectedGenreIds);
        }

        const response = await apiClient.getContents(params);
        if (response?.status && Array.isArray(response.data)) {
          setMangaList(response.data);

          // Support both response.meta and response.pagination
          const totalPagesFromApi =
            response.meta?.total_pages ||
            response.meta?.totalPages ||
            response.pagination?.total_pages ||
            1;
          const totalCountFromApi =
            response.meta?.total ?? response.pagination?.total ?? response.data.length;

          setTotalPages(Math.max(1, Number(totalPagesFromApi) || 1));
          setTotalItems(Number(totalCountFromApi) || 0);
          setPage(pageNumber);
        } else {
          setMangaList([]);
          setTotalPages(1);
          setTotalItems(0);
        }
      } catch (err) {
        console.warn('Error fetching contents:', err);
        setMangaList([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      debouncedQuery,
      selectedType,
      selectedStatus,
      selectedOrder,
      selectedProject,
      selectedSource,
      selectedGenreIds,
    ]
  );

  // Trigger fetch when any filter changes or search changes
  useEffect(() => {
    setPage(1);
    fetchManga(1);
  }, [fetchManga]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchManga(page, true);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    fetchManga(newPage);
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
    setSelectedSource('all');
    setSelectedGenreIds(new Set());
    setSearchQuery('');
    setDebouncedQuery('');
    setPage(1);
  };

  const hasActiveFilters =
    selectedType !== 'All' ||
    selectedStatus !== 'All' ||
    selectedOrder !== 'Update' ||
    selectedProject !== 'all' ||
    selectedSource !== 'all' ||
    selectedGenreIds.size > 0 ||
    !!debouncedQuery;

  // Filtered genres based on search in modal
  const filteredGenresList = useMemo(() => {
    if (!genreSearchInput.trim()) return genres;
    const q = genreSearchInput.toLowerCase().trim();
    return genres.filter((g) => (g.name || g.title || '').toLowerCase().includes(q));
  }, [genres, genreSearchInput]);

  // Bottom Pagination Controls Component matching Web
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const maxVisible = 3;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <View style={styles.paginationWrapper}>
        <View style={styles.paginationRow}>
          {/* Prev Button */}
          <TouchableOpacity
            style={[styles.pageNavBtn, page === 1 && styles.pageNavBtnDisabled]}
            disabled={page === 1}
            onPress={() => handlePageChange(page - 1)}
          >
            <Ionicons
              name="chevron-back"
              size={16}
              color={page === 1 ? '#4B5563' : '#FFF'}
            />
          </TouchableOpacity>

          {/* First Page */}
          {startPage > 1 && (
            <>
              <TouchableOpacity
                style={[styles.pageNumBtn, page === 1 && styles.pageNumBtnActive]}
                onPress={() => handlePageChange(1)}
              >
                <Text style={[styles.pageNumText, page === 1 && styles.pageNumTextActive]}>
                  1
                </Text>
              </TouchableOpacity>
              {startPage > 2 && <Text style={styles.pageEllipsis}>...</Text>}
            </>
          )}

          {/* Visible Page Numbers */}
          {pageNumbers.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.pageNumBtn, page === p && styles.pageNumBtnActive]}
              onPress={() => handlePageChange(p)}
            >
              <Text style={[styles.pageNumText, page === p && styles.pageNumTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Last Page */}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <Text style={styles.pageEllipsis}>...</Text>}
              <TouchableOpacity
                style={[styles.pageNumBtn, page === totalPages && styles.pageNumBtnActive]}
                onPress={() => handlePageChange(totalPages)}
              >
                <Text
                  style={[
                    styles.pageNumText,
                    page === totalPages && styles.pageNumTextActive,
                  ]}
                >
                  {totalPages}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Next Button */}
          <TouchableOpacity
            style={[styles.pageNavBtn, page === totalPages && styles.pageNavBtnDisabled]}
            disabled={page === totalPages}
            onPress={() => handlePageChange(page + 1)}
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color={page === totalPages ? '#4B5563' : '#FFF'}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.paginationSummary}>
          Halaman {page} dari {totalPages} ({totalItems} komik)
        </Text>
      </View>
    );
  };

  // Render Item for List View
  const renderListItem = ({ item }) => {
    const imageUrl = getImageUrl(item.cover || item.image || item.thumbnail);
    const title = item.title || 'Tanpa Judul';
    const rating = Number(item.rating || item.score || 0).toFixed(1);
    const latestChapter =
      item.latest_chapter ||
      (Array.isArray(item.chapters) && item.chapters[0]) ||
      (Array.isArray(item.lastChapters) && item.lastChapters[0]) ||
      null;

    return (
      <TouchableOpacity
        style={styles.listItemCard}
        activeOpacity={0.8}
        onPress={() => handleMangaPress(item)}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.listItemCover}
          contentFit="cover"
          cachePolicy="memory-disk"
        />

        <View style={styles.listItemInfo}>
          <View style={styles.listItemTopRow}>
            {item.type && (
              <View style={styles.listItemTypeBadge}>
                <Text style={styles.listItemTypeBadgeText}>{item.type.toUpperCase()}</Text>
              </View>
            )}
            {item.status && (
              <Text style={styles.listItemStatusText}>• {item.status}</Text>
            )}
          </View>

          <Text numberOfLines={2} style={styles.listItemTitle}>
            {title}
          </Text>

          <View style={styles.listItemBottomRow}>
            {rating > 0 ? (
              <View style={styles.listItemRating}>
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text style={styles.listItemRatingText}>{rating}</Text>
              </View>
            ) : null}

            {latestChapter ? (
              <TouchableOpacity
                style={styles.listItemChapterBtn}
                onPress={() => handleChapterPress(latestChapter, item)}
              >
                <Ionicons name="book-outline" size={12} color={COLORS.primary} />
                <Text numberOfLines={1} style={styles.listItemChapterText}>
                  Ch. {latestChapter.number || latestChapter.chapter_number || latestChapter.chapter || '?'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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

      {/* Control Bar: View Mode Switcher + Filter Button + Quick Pills */}
      <View style={styles.controlBarWrapper}>
        <View style={styles.controlBarLeft}>
          {/* Filter Modal Trigger Button */}
          <TouchableOpacity
            style={[styles.filterTriggerBtn, activeFilterCount > 0 && styles.filterTriggerBtnActive]}
            activeOpacity={0.8}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons
              name="options"
              size={16}
              color={activeFilterCount > 0 ? '#FFF' : '#DC2626'}
            />
            <Text
              style={[
                styles.filterTriggerBtnText,
                activeFilterCount > 0 && styles.filterTriggerBtnTextActive,
              ]}
            >
              Filter {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>

          {/* View Mode Toggle Pill (Grid / List) matching Content.jsx */}
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('grid')}
            >
              <Ionicons
                name="grid"
                size={14}
                color={viewMode === 'grid' ? '#FFF' : '#9CA3AF'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons
                name="list"
                size={16}
                color={viewMode === 'list' ? '#FFF' : '#9CA3AF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Order Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFiltersScroll}
        >
          {ORDER_OPTIONS.map((ord) => (
            <TouchableOpacity
              key={ord.value}
              style={[
                styles.quickPill,
                selectedOrder === ord.value && styles.quickPillActive,
              ]}
              onPress={() => setSelectedOrder(ord.value)}
            >
              <Text
                style={[
                  styles.quickPillText,
                  selectedOrder === ord.value && styles.quickPillTextActive,
                ]}
              >
                {ord.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Comic List / Grid */}
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
          ref={flatListRef}
          data={mangaList}
          key={viewMode} // Re-mount when switching between 1-col list and 2-col grid
          keyExtractor={(item, idx) => `${item.id || item.slug}-${idx}`}
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? styles.columnWrapper : null}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={
            viewMode === 'grid'
              ? ({ item }) => (
                  <MangaCard
                    manga={item}
                    columns={2}
                    showLastChapters={true}
                    isAuthenticated={isAuthenticated}
                    onPress={handleMangaPress}
                    onChapterPress={handleChapterPress}
                  />
                )
              : renderListItem
          }
          ListHeaderComponent={
            comicTopAds.length > 0 ? (
              <AdBanner ads={comicTopAds} columns={2} style={styles.topAd} />
            ) : null
          }
          ListFooterComponent={
            <View>
              {/* Pagination controls at the bottom */}
              {renderPagination()}

              {comicFooterAds.length > 0 && (
                <AdBanner ads={comicFooterAds} columns={2} style={styles.footerAd} />
              )}
            </View>
          }
        />
      )}

      {/* FILTER BOTTOM SHEET / MODAL matching src/pages/Content.jsx */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="options" size={18} color="#DC2626" />
                <Text style={styles.modalTitle}>FILTER KOMIK</Text>
                {activeFilterCount > 0 && (
                  <View style={styles.activeFilterPill}>
                    <Text style={styles.activeFilterPillText}>{activeFilterCount}</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalHeaderRight}>
                {activeFilterCount > 0 && (
                  <TouchableOpacity
                    style={styles.modalResetBtn}
                    onPress={clearAllFilters}
                  >
                    <Text style={styles.modalResetBtnText}>Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setFilterModalVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable Filter Options matching Web Content.jsx */}
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.filterModalScroll}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. STATUS */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>STATUS</Text>
                <View style={styles.filterChipsRow}>
                  {STATUS_OPTIONS.map((status) => {
                    const isSelected = selectedStatus === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.filterChip,
                          isSelected && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedStatus(status)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isSelected && styles.filterChipTextActive,
                          ]}
                        >
                          {status}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 2. TIPE / KATEGORI */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>TIPE / KATEGORI</Text>
                <View style={styles.filterChipsRow}>
                  {TYPE_OPTIONS.map((type) => {
                    const isSelected = selectedType === type.value;
                    return (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.filterChip,
                          isSelected && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedType(type.value)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isSelected && styles.filterChipTextActive,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 3. PROJECT */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>PROJECT</Text>
                <View style={styles.filterChipsRow}>
                  {PROJECT_OPTIONS.map((opt) => {
                    const isSelected = selectedProject === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.filterChip,
                          isSelected && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedProject(opt.value)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isSelected && styles.filterChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 4. SOURCE */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>SOURCE</Text>
                <View style={styles.filterChipsRow}>
                  {SOURCE_OPTIONS.map((opt) => {
                    const isSelected = selectedSource === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.filterChip,
                          isSelected && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedSource(opt.value)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isSelected && styles.filterChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 5. URUTKAN */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>URUTKAN</Text>
                <View style={styles.filterChipsRow}>
                  {ORDER_OPTIONS.map((ord) => {
                    const isSelected = selectedOrder === ord.value;
                    return (
                      <TouchableOpacity
                        key={ord.value}
                        style={[
                          styles.filterChip,
                          isSelected && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedOrder(ord.value)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isSelected && styles.filterChipTextActive,
                          ]}
                        >
                          {ord.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 6. GENRE MULTI-SELECT */}
              <View style={styles.filterSection}>
                <View style={styles.genreSectionHeader}>
                  <Text style={styles.filterSectionTitle}>
                    GENRE {selectedGenreIds.size > 0 ? `(${selectedGenreIds.size} dipilih)` : ''}
                  </Text>
                  {selectedGenreIds.size > 0 && (
                    <TouchableOpacity
                      onPress={() => setSelectedGenreIds(new Set())}
                    >
                      <Text style={styles.clearGenreText}>Bersihkan Genre</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Genre Search Bar */}
                <View style={styles.genreSearchBox}>
                  <Ionicons name="search" size={14} color="#6B7280" />
                  <TextInput
                    style={styles.genreSearchInput}
                    placeholder="Cari genre..."
                    placeholderTextColor="#6B7280"
                    value={genreSearchInput}
                    onChangeText={setGenreSearchInput}
                  />
                  {genreSearchInput ? (
                    <TouchableOpacity onPress={() => setGenreSearchInput('')}>
                      <Ionicons name="close-circle" size={14} color="#9CA3AF" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {genresLoading ? (
                  <View style={styles.genreLoadingBox}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.genreLoadingText}>Memuat genre...</Text>
                  </View>
                ) : (
                  <View style={styles.genreChipsContainer}>
                    {filteredGenresList.map((g) => {
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
                          {isSelected && (
                            <Ionicons name="checkmark" size={12} color="#FFF" />
                          )}
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
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Bottom Apply Button */}
            <View style={[styles.modalFooterBar, { paddingBottom: modalBottomInset + 8 }]}>
              <TouchableOpacity
                style={styles.modalApplyButton}
                activeOpacity={0.85}
                onPress={() => {
                  setFilterModalVisible(false);
                  setPage(1);
                  fetchManga(1);
                }}
              >
                <LinearGradient
                  colors={['#DC2626', '#B91C1C']}
                  style={styles.modalApplyButtonGradient}
                >
                  <Text style={styles.modalApplyButtonText}>
                    Terapkan Filter {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                  </Text>
                </LinearGradient>
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
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },

  // Control Bar
  controlBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  controlBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  filterTriggerBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTriggerBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTriggerBtnTextActive: {
    color: '#FFF',
  },
  viewModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.md,
    padding: 2,
  },
  viewModeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  viewModeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  quickFiltersScroll: {
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  quickPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickPillActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  quickPillText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  quickPillTextActive: {
    color: '#F87171',
    fontWeight: '700',
  },

  // List View
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  listItemCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
    overflow: 'hidden',
    padding: 8,
    gap: 12,
  },
  listItemCover: {
    width: 65,
    height: 90,
    borderRadius: RADIUS.md,
    backgroundColor: '#1E293B',
  },
  listItemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  listItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listItemTypeBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
  },
  listItemTypeBadgeText: {
    color: '#60A5FA',
    fontSize: 9,
    fontWeight: '800',
  },
  listItemStatusText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
  },
  listItemTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  listItemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listItemRatingText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  listItemChapterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  listItemChapterText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '700',
  },

  // Pagination Styles matching Web Content.jsx
  paginationWrapper: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pageNavBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNavBtnDisabled: {
    opacity: 0.35,
  },
  pageNumBtn: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumBtnActive: {
    backgroundColor: COLORS.primary,
  },
  pageNumText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  pageNumTextActive: {
    color: '#FFF',
    fontWeight: '900',
  },
  pageEllipsis: {
    color: '#6B7280',
    fontSize: 14,
    paddingHorizontal: 4,
  },
  paginationSummary: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },

  // Loading & Ads
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  topAd: {
    marginBottom: SPACING.md,
  },
  footerAd: {
    marginVertical: SPACING.md,
  },

  // Modal Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalScrollView: {
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeFilterPill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  activeFilterPillText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalResetBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalResetBtnText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },

  filterModalScroll: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
    gap: SPACING.lg,
  },
  filterSection: {
    gap: 10,
  },
  filterSectionTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },

  // Genre in Modal
  genreSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearGenreText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
  },
  genreSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  genreSearchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 12,
    padding: 0,
  },
  genreLoadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  genreLoadingText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  genreChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  genreChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genreChipText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  genreChipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },

  // Modal Apply Footer
  modalFooterBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0D1117',
  },
  modalApplyButton: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  modalApplyButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  modalApplyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

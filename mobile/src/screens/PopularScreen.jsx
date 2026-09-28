import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiClient, getImageUrl } from '../api/client';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { EmptyState } from '../components/EmptyState';
import { AdBanner } from '../components/AdBanner';
import { useAds } from '../hooks/useAds';

const TABS = [
  { id: 'manhwa', label: 'Manhwa (KR)' },
  { id: 'manga', label: 'Manga (JP)' },
  { id: 'manhua', label: 'Manhua (CN)' },
];

export const PopularScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('manhwa');
  const [mangaList, setMangaList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Ads mirroring web positions
  const { ads: popularTopAds } = useAds('popular-top');
  const { ads: popularFooterAds } = useAds('popular-footer');

  const fetchPopular = useCallback(
    async (pageNumber = 1, isRefresh = false) => {
      if (pageNumber === 1 && !isRefresh) {
        setLoading(true);
      } else if (pageNumber > 1) {
        setLoadingMore(true);
      }

      try {
        const response = await apiClient.getPopularManga(activeTab, pageNumber, 15);
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
        console.warn('Error fetching popular:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    setPage(1);
    fetchPopular(1);
  }, [fetchPopular]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchPopular(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && page < totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPopular(nextPage);
    }
  };

  const handleMangaPress = (manga) => {
    const slug = manga.slug || manga.id;
    if (slug) {
      navigation.navigate('MangaDetail', { slug, title: manga.title });
    }
  };

  const getRankBadgeStyle = (rank) => {
    if (rank === 1) return { bg: '#EAB308', text: '#000' }; // Gold
    if (rank === 2) return { bg: '#94A3B8', text: '#000' }; // Silver
    if (rank === 3) return { bg: '#B45309', text: '#FFF' }; // Bronze
    return { bg: COLORS.surfaceElevated, text: COLORS.textSecondary };
  };

  const renderRankItem = ({ item, index }) => {
    const rank = index + 1;
    const badgeStyle = getRankBadgeStyle(rank);
    const coverUrl = getImageUrl(item.cover || item.image || item.thumbnail);
    const rating = Number(item.rating || item.score || 0).toFixed(1);
    const views = item.views ? Number(item.views).toLocaleString('id-ID') : null;
    const latestChapter =
      item.latest_chapter?.number ||
      item.latest_chapter?.chapter_number ||
      item.chapter;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleMangaPress(item)}
        style={styles.cardItem}
      >
        {/* Rank Badge */}
        <View style={[styles.rankBadge, { backgroundColor: badgeStyle.bg }]}>
          <Text style={[styles.rankText, { color: badgeStyle.text }]}>
            {rank}
          </Text>
        </View>

        {/* Cover */}
        <View style={styles.coverWrapper}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderCover}>
              <Ionicons name="book-outline" size={20} color={COLORS.textMuted} />
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.infoWrapper}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.title}
          </Text>

          <View style={styles.metaRow}>
            {Number(rating) > 0 && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={11} color={COLORS.star} />
                <Text style={styles.ratingValue}>{rating}</Text>
              </View>
            )}

            {views && (
              <View style={styles.viewsBadge}>
                <Ionicons name="eye-outline" size={11} color={COLORS.textMuted} />
                <Text style={styles.viewsText}>{views}</Text>
              </View>
            )}

            <View style={[styles.statusBadge, item.status === 'Completed' ? styles.statusCompleted : styles.statusOngoing]}>
              <Text style={styles.statusText}>{item.status || 'Ongoing'}</Text>
            </View>
          </View>

          {item.genres ? (
            <Text numberOfLines={1} style={styles.genresText}>
              {Array.isArray(item.genres)
                ? item.genres.map((g) => (typeof g === 'string' ? g : g.name)).join(' • ')
                : String(item.genres)}
            </Text>
          ) : null}

          {latestChapter ? (
            <View style={styles.latestChapterRow}>
              <Text style={styles.latestChapterLabel}>Chapter terbaru:</Text>
              <Text style={styles.latestChapterValue}>Ch. {latestChapter}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="flame" size={24} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Komik Populer</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Daftar komik dengan pembaca dan upvote terbanyak
        </Text>

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.8}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Memuat komik populer...</Text>
        </View>
      ) : mangaList.length === 0 ? (
        <EmptyState
          icon="flame-outline"
          title="Tidak Ada Data Populer"
          description="Belum ada komik populer untuk kategori ini."
        />
      ) : (
        <FlatList
          data={mangaList}
          keyExtractor={(item, idx) => `${item.id || item.slug}-${idx}`}
          renderItem={renderRankItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            popularTopAds.length > 0 ? (
              <AdBanner ads={popularTopAds} columns={1} style={styles.topAd} containerPadding={0} />
            ) : null
          }
          ListFooterComponent={
            <View>
              {loadingMore && (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              )}
              {popularFooterAds.length > 0 && (
                <AdBanner ads={popularFooterAds} columns={1} style={styles.footerAd} containerPadding={0} />
              )}
            </View>
          }
        />
      )}
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
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 3,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '900',
  },
  coverWrapper: {
    width: 60,
    height: 84,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceElevated,
    marginRight: SPACING.md,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoWrapper: {
    flex: 1,
  },
  itemTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingValue: {
    color: COLORS.star,
    fontSize: 11,
    fontWeight: '700',
  },
  viewsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewsText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.sm - 2,
  },
  statusOngoing: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.ongoing,
  },
  genresText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  latestChapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  latestChapterLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  latestChapterValue: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
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
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
});

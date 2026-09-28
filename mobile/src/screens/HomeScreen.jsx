import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Linking,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient, getImageUrl, setCdnDomain } from '../api/client';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { MangaCard } from '../components/MangaCard';
import { SectionHeader } from '../components/SectionHeader';
import { ChatroomCard } from '../components/ChatroomCard';
import { AdBanner } from '../components/AdBanner';
import { useAds } from '../hooks/useAds';
import { useAuth } from '../contexts/AuthContext';
import { requiresChapterLogin } from '../utils/chapterAccess';
import { ChapterAccessModal } from '../components/ChapterAccessModal';
import { storage } from '../utils/storage';

const { width, height } = Dimensions.get('window');
const BANNER_WIDTH = width - SPACING.lg * 2;
const BANNER_HEIGHT = BANNER_WIDTH * 0.54;

const POPULAR_CARD_WIDTH = Math.round(width * 0.58);
const POPULAR_GAP = SPACING.md;
const POPULAR_SNAP_INTERVAL = POPULAR_CARD_WIDTH + POPULAR_GAP;
const POPULAR_SIDE_PADDING = Math.round((width - POPULAR_CARD_WIDTH) / 2);

const extractBannerSlug = (item) => {
  if (item.slug && item.slug.trim()) return item.slug.trim();
  if (item.manga_slug && item.manga_slug.trim()) return item.manga_slug.trim();
  if (item.href) {
    const match = item.href.match(/\/komik\/([^/?#]+)/);
    if (match && match[1]) return match[1];
    const segments = item.href.replace(/\/+$/, '').split('/');
    return segments[segments.length - 1];
  }
  return item.id;
};

// Isolated Hero Banner Slider - auto-scroll timer runs inside this component only
const HeroBannerSlider = React.memo(({ banners, onBannerPress }) => {
  const bannerScrollRef = useRef(null);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => {
        const next = (prev + 1) % banners.length;
        bannerScrollRef.current?.scrollTo({ x: next * (BANNER_WIDTH + SPACING.md), animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [banners?.length]);

  const handleBannerPrev = () => {
    if (!banners || banners.length <= 1) return;
    const prev = (activeBannerIdx - 1 + banners.length) % banners.length;
    setActiveBannerIdx(prev);
    bannerScrollRef.current?.scrollTo({ x: prev * (BANNER_WIDTH + SPACING.md), animated: true });
  };

  const handleBannerNext = () => {
    if (!banners || banners.length <= 1) return;
    const next = (activeBannerIdx + 1) % banners.length;
    setActiveBannerIdx(next);
    bannerScrollRef.current?.scrollTo({ x: next * (BANNER_WIDTH + SPACING.md), animated: true });
  };

  if (!banners || banners.length === 0) return null;

  return (
    <View style={styles.heroSectionWrapper}>
      <View style={styles.bannerSliderContainer}>
        {banners.length > 1 && (
          <>
            <TouchableOpacity
              style={[styles.bannerNavBtn, styles.bannerNavBtnLeft]}
              onPress={handleBannerPrev}
              activeOpacity={0.8}
              accessibilityLabel="Previous Banner"
            >
              <Ionicons name="chevron-back" size={18} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bannerNavBtn, styles.bannerNavBtnRight]}
              onPress={handleBannerNext}
              activeOpacity={0.8}
              accessibilityLabel="Next Banner"
            >
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </>
        )}

        <ScrollView
          ref={bannerScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={BANNER_WIDTH + SPACING.md}
          decelerationRate="fast"
          contentContainerStyle={styles.bannerList}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (BANNER_WIDTH + SPACING.md));
            setActiveBannerIdx(idx);
          }}
        >
          {banners.map((item, idx) => {
            const bannerUrl = getImageUrl(item.image || item.image_url || item.banner_url || item.cover);
            const slug = extractBannerSlug(item);
            const seriesTag = item.series || 'HOT';
            const rating = item.rating ? Number(item.rating).toFixed(1) : null;

            return (
              <TouchableOpacity
                key={item.id || idx}
                activeOpacity={0.92}
                onPress={() => onBannerPress(slug, item.title)}
                style={styles.bannerCard}
              >
                <Image
                  source={{ uri: bannerUrl }}
                  style={styles.bannerImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="high"
                  transition={200}
                />

                <View style={styles.bannerTopBadges}>
                  {seriesTag ? (
                    <View style={styles.seriesBadge}>
                      <Text style={styles.seriesBadgeText}>{seriesTag.toUpperCase()}</Text>
                    </View>
                  ) : null}
                  {rating ? (
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={10} color={COLORS.star} />
                      <Text style={styles.ratingBadgeText}>{rating}</Text>
                    </View>
                  ) : null}
                </View>

                <LinearGradient
                  colors={['transparent', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.95)']}
                  style={styles.bannerGradient}
                >
                  <Text numberOfLines={2} style={styles.bannerTitle}>
                    {item.title}
                  </Text>

                  <View style={styles.readNowBtn}>
                    <Ionicons name="book" size={12} color="#FFF" />
                    <Text style={styles.readNowBtnText}>BACA SEKARANG</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {banners.length > 1 && (
        <View style={styles.bannerDotsContainer}>
          {banners.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[
                styles.bannerDot,
                i === activeBannerIdx && styles.bannerDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

// Isolated Popular Slider - Infinite seamless auto-loop carousel
const PopularSlider = React.memo(({ items, onMangaPress }) => {
  const popularScrollRef = useRef(null);
  const isDraggingPopularRef = useRef(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const N = items?.length || 0;
  const MULTIPLIER = N > 1 ? 5 : 1;
  const middleSetStart = N > 1 ? N * 2 : 0;

  const [currentIndex, setCurrentIndex] = useState(middleSetStart);

  // Extended looping array
  const extendedItems = useMemo(() => {
    if (!items || N === 0) return [];
    if (N === 1) return items;
    const list = [];
    for (let i = 0; i < MULTIPLIER; i++) {
      list.push(...items);
    }
    return list;
  }, [items, N, MULTIPLIER]);

  // Initial scroll to middle set on mount
  const handleLayout = () => {
    if (!hasInitialized && N > 1) {
      setHasInitialized(true);
      setCurrentIndex(middleSetStart);
      setTimeout(() => {
        popularScrollRef.current?.scrollTo({
          x: middleSetStart * POPULAR_SNAP_INTERVAL,
          animated: false,
        });
      }, 50);
    }
  };

  // Normalization logic: seamlessly reset to middle set if scrolled too far left or right
  const normalizePosition = useCallback(
    (targetIdx) => {
      if (N <= 1) return targetIdx;
      let normalized = targetIdx;
      const minThreshold = Math.round(N * 1.5);
      const maxThreshold = Math.round(N * 3.5);

      if (targetIdx < minThreshold) {
        normalized = targetIdx + N;
        popularScrollRef.current?.scrollTo({
          x: normalized * POPULAR_SNAP_INTERVAL,
          animated: false,
        });
        setCurrentIndex(normalized);
        return normalized;
      } else if (targetIdx >= maxThreshold) {
        normalized = targetIdx - N;
        popularScrollRef.current?.scrollTo({
          x: normalized * POPULAR_SNAP_INTERVAL,
          animated: false,
        });
        setCurrentIndex(normalized);
        return normalized;
      }

      setCurrentIndex(targetIdx);
      return targetIdx;
    },
    [N]
  );

  // Auto-scroll loop timer
  useEffect(() => {
    if (N <= 1) return;
    const timer = setInterval(() => {
      if (!isDraggingPopularRef.current) {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          popularScrollRef.current?.scrollTo({
            x: next * POPULAR_SNAP_INTERVAL,
            animated: true,
          });
          return next;
        });
      }
    }, 4500);

    return () => clearInterval(timer);
  }, [N]);

  const handlePopularPrev = () => {
    if (N <= 1) return;
    const prev = currentIndex - 1;
    setCurrentIndex(prev);
    popularScrollRef.current?.scrollTo({
      x: prev * POPULAR_SNAP_INTERVAL,
      animated: true,
    });
  };

  const handlePopularNext = () => {
    if (N <= 1) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    popularScrollRef.current?.scrollTo({
      x: next * POPULAR_SNAP_INTERVAL,
      animated: true,
    });
  };

  const handlePopularScroll = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const rawIdx = Math.round(offsetX / POPULAR_SNAP_INTERVAL);
    if (rawIdx !== currentIndex) {
      setCurrentIndex(rawIdx);
    }
  };

  const handlePopularScrollBegin = () => {
    isDraggingPopularRef.current = true;
  };

  const handlePopularScrollEnd = (e) => {
    isDraggingPopularRef.current = false;
    const offsetX = e.nativeEvent.contentOffset.x;
    const rawIdx = Math.round(offsetX / POPULAR_SNAP_INTERVAL);
    normalizePosition(rawIdx);
  };

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.popularSectionWrapper}>
      <View style={styles.popularHeaderCenter}>
        <View style={styles.popularHeaderPill}>
          <Text style={styles.popularFireIcon}>🔥</Text>
          <Text style={styles.popularHeaderText}>Popular Today</Text>
        </View>
      </View>

      <View style={styles.popularSliderWrapper}>
        <TouchableOpacity
          style={[styles.popularNavBtn, styles.popularNavBtnLeft]}
          onPress={handlePopularPrev}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.popularNavBtn, styles.popularNavBtnRight]}
          onPress={handlePopularNext}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-forward" size={20} color="#FFF" />
        </TouchableOpacity>

        <ScrollView
          ref={popularScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={POPULAR_SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum={true}
          contentContainerStyle={styles.popularSlidesContainer}
          onLayout={handleLayout}
          onScrollBeginDrag={handlePopularScrollBegin}
          onScroll={handlePopularScroll}
          scrollEventThrottle={32}
          onScrollEndDrag={handlePopularScrollEnd}
          onMomentumScrollEnd={handlePopularScrollEnd}
        >
          {extendedItems.map((item, idx) => {
            const originalIdx = N > 0 ? idx % N : 0;
            const coverUrl = getImageUrl(item.cover || item.image || item.thumbnail);
            const latestCh = item?.lastChapters?.[0] || item?.latest_chapter;
            const chNum = latestCh?.number || latestCh?.chapter_number || item?.chapter || null;
            const isCurrentActive = idx === currentIndex;

            return (
              <TouchableOpacity
                key={`pop-loop-${item.id || item.slug}-${idx}`}
                activeOpacity={0.88}
                onPress={() => {
                  if (isCurrentActive) {
                    onMangaPress(item);
                  } else {
                    setCurrentIndex(idx);
                    popularScrollRef.current?.scrollTo({
                      x: idx * POPULAR_SNAP_INTERVAL,
                      animated: true,
                    });
                  }
                }}
                style={[
                  styles.popularSlideCard,
                  isCurrentActive ? styles.popularSlideCardActive : styles.popularSlideCardInactive,
                  { marginRight: POPULAR_GAP },
                ]}
              >
                <View style={styles.popularCardCoverWrapper}>
                  {coverUrl ? (
                    <Image
                      source={{ uri: coverUrl }}
                      style={styles.popularCardCover}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      transition={150}
                    />
                  ) : (
                    <View style={styles.placeholderCover}>
                      <Ionicons name="book-outline" size={32} color={COLORS.textMuted} />
                    </View>
                  )}

                  <View
                    style={[
                      styles.slideRankBadge,
                      originalIdx === 0
                        ? styles.rankGold
                        : originalIdx === 1
                        ? styles.rankSilver
                        : originalIdx === 2
                        ? styles.rankBronze
                        : styles.rankDefault,
                    ]}
                  >
                    <Text
                      style={[
                        styles.slideRankText,
                        originalIdx <= 1 ? { color: '#000' } : { color: '#FFF' },
                      ]}
                    >
                      #{originalIdx + 1}
                    </Text>
                  </View>

                  <LinearGradient
                    colors={['transparent', 'rgba(0, 0, 0, 0.95)']}
                    style={styles.popularCoverGradient}
                  />
                </View>

                <View style={styles.popularCardFooter}>
                  <Text numberOfLines={1} style={styles.popularCardTitle}>
                    {item.title}
                  </Text>

                  <View style={styles.popularMetaRow}>
                    <Text style={styles.popularChapterText}>
                      {chNum ? `Chapter ${chNum}` : 'Komik Populer'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
});

export const HomeScreen = ({ navigation }) => {
  const { isAuthenticated, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // User Profile Picture & VIP status in Header
  const userAvatarPath = user?.profile_image || user?.avatar || user?.image || user?.avatar_url || null;
  const [avatarError, setAvatarError] = useState(false);
  const membershipType = String(user?.membership_type || '').toLowerCase().trim();
  const isMobileVip =
    user?.role === 'admin' ||
    (Boolean(user?.membership_active || user?.role === 'vip' || user?.role === 'premium') &&
      (membershipType === 'mobile' || membershipType === 'both'));

  useEffect(() => {
    setAvatarError(false);
  }, [userAvatarPath]);

  // Access Modal state for restricted chapters
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [lockedChapterInfo, setLockedChapterInfo] = useState({ chapter: null, manga: null });

  // Data states matching web Home.jsx sections
  const [banners, setBanners] = useState([]);
  const [quickLinks, setQuickLinks] = useState([]);
  const [popularManga, setPopularManga] = useState([]);
  const [projectManga, setProjectManga] = useState([]);
  const [latestUpdates, setLatestUpdates] = useState([]);
  const [manhwaList, setManhwaList] = useState([]);
  const [mangaList, setMangaList] = useState([]);
  const [manhuaList, setManhuaList] = useState([]);

  // Ads mirroring web positions
  const { ads: homeTopAds } = useAds('home-top');
  const { ads: projectTopAds } = useAds('project-top');
  const { ads: updateTopAds } = useAds('update-top');
  const { ads: homeManhwaAds } = useAds('home-manhwa-top');
  const { ads: homeMangaAds } = useAds('home-manga-top');
  const { ads: homeManhuaAds } = useAds('home-manhua-top');
  const { ads: homeFooterAds } = useAds('home-footer');

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch settings (CDN domain, quick links, hero_banners)
      const settingsPromise = apiClient.getSettings().then((s) => {
        if (s?.cdn_domain) setCdnDomain(s.cdn_domain);
        if (Array.isArray(s?.quick_links) && s.quick_links.length > 0) {
          const activeLinks = s.quick_links.filter((q) => q.is_active !== false);
          if (activeLinks.length > 0) setQuickLinks(activeLinks);
        }
        if (Array.isArray(s?.hero_banners) && s.hero_banners.length > 0) {
          return s.hero_banners.filter((b) => b.is_active !== false);
        }
        return [];
      }).catch(() => []);

      // 2. Fetch all sections in parallel using allSettled for resilience
      const [
        settingsBannersRes,
        featuredRes,
        popularRes,
        projectRes,
        latestRes,
        manhwaRes,
        mangaRes,
        manhuaRes,
      ] = await Promise.allSettled([
        settingsPromise,
        // Fallback featured items
        apiClient.getFeaturedItems('banner', true),
        // 1. Paling Populer (Full carousel / slides)
        apiClient.getContents({ page: 1, per_page: 10, orderBy: 'Popular', popularWindow: 'day' }),
        // 2. Projek KomikNesia
        apiClient.getContents({ page: 1, per_page: 6, orderBy: 'Update', project: 'true' }),
        // 3. Update Terbaru
        apiClient.getContents({ page: 1, per_page: 8, orderBy: 'Update' }),
        // 4. Manhwa Section
        apiClient.getContents({ page: 1, per_page: 6, type: 'manhwa', orderBy: 'Update' }),
        // 5. Manga Section
        apiClient.getContents({ page: 1, per_page: 6, type: 'manga', orderBy: 'Update' }),
        // 6. Manhua Section
        apiClient.getContents({ page: 1, per_page: 6, type: 'manhua', orderBy: 'Update' }),
      ]);

      // Set banners: prioritize settings.hero_banners, fallback to featured items
      const settingsBanners = settingsBannersRes.status === 'fulfilled' ? settingsBannersRes.value : [];
      const featuredBanners = featuredRes.status === 'fulfilled' && Array.isArray(featuredRes.value) ? featuredRes.value : [];
      const resolvedBanners = settingsBanners.length > 0 ? settingsBanners : featuredBanners;
      setBanners(resolvedBanners);

      if (popularRes.status === 'fulfilled' && Array.isArray(popularRes.value?.data)) {
        setPopularManga(popularRes.value.data);
      }
      if (projectRes.status === 'fulfilled' && Array.isArray(projectRes.value?.data)) {
        setProjectManga(projectRes.value.data);
      }
      if (latestRes.status === 'fulfilled' && Array.isArray(latestRes.value?.data)) {
        setLatestUpdates(latestRes.value.data);
      }
      if (manhwaRes.status === 'fulfilled' && Array.isArray(manhwaRes.value?.data)) {
        setManhwaList(manhwaRes.value.data);
      }
      if (mangaRes.status === 'fulfilled' && Array.isArray(mangaRes.value?.data)) {
        setMangaList(mangaRes.value.data);
      }
      if (manhuaRes.status === 'fulfilled' && Array.isArray(manhuaRes.value?.data)) {
        setManhuaList(manhuaRes.value.data);
      }
    } catch (err) {
      console.warn('Error loading home data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBannerPress = useCallback((slug, title) => {
    if (slug) {
      navigation.navigate('MangaDetail', { slug, title });
    }
  }, [navigation]);

  const handleMangaPress = useCallback((manga) => {
    const slug = manga?.slug || manga?.id;
    if (slug) {
      navigation.navigate('MangaDetail', { slug, title: manga.title });
    }
  }, [navigation]);

  const handleChapterPress = useCallback((chapter, manga) => {
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
  }, [navigation, isAuthenticated, handleMangaPress]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Top App Bar: User greeting after login or official logo for guests */}
      <View style={styles.topBar}>
        {isAuthenticated && user ? (
          <TouchableOpacity
            style={styles.userHeaderBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Akun')}
          >
            <View style={styles.userAvatarBox}>
              {userAvatarPath && !avatarError ? (
                <Image
                  source={{ uri: getImageUrl(userAvatarPath) }}
                  style={styles.userAvatarImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <LinearGradient
                  colors={[COLORS.primary, '#831843']}
                  style={styles.userAvatarPlaceholder}
                >
                  <Text style={styles.userAvatarInitial}>
                    {(user.name || user.username || 'U')[0].toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              {isMobileVip && (
                <View style={styles.vipBadgeDot}>
                  <Ionicons name="sparkles" size={8} color="#FFF" />
                </View>
              )}
            </View>

            <View style={styles.userNameWrapper}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.userGreetingName}
              >
                {user.name || user.username}
              </Text>
              <Text style={styles.userGreetingWave}>👋</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.headerLogo}
              contentFit="contain"
            />
          </View>
        )}

        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.searchIconButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Jelajah')}
          >
            <Ionicons name="search" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Memuat konten KomikNesia...</Text>
          </View>
        ) : (
          <>
            {/* Home Top Ads (Sama seperti Web) */}
            {homeTopAds.length > 0 && (
              <AdBanner ads={homeTopAds} columns={1} style={styles.sectionAdBanner} />
            )}

            {/* 1. HERO BANNER SECTION (PALING PERTAMA) */}
            <HeroBannerSlider banners={banners} onBannerPress={handleBannerPress} />

            {/* 2. POPULER SECTION (DIJADIKAN SLIDES) */}
            <PopularSlider items={popularManga} onMangaPress={handleMangaPress} />

            {/* 3. CHATROOM SECTION */}
            <ChatroomCard navigation={navigation} />

            {/* 4. PROJEK KOMIKNESIA SECTION */}
            {projectTopAds.length > 0 && (
              <AdBanner ads={projectTopAds} columns={1} style={styles.sectionAdBanner} />
            )}
            {projectManga.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="Projek KomikNesia"
                  subtitle="Komik resmi garapan tim KomikNesia"
                  icon={<Ionicons name="folder-open" size={17} color={COLORS.primary} />}
                  onSeeAll={() => navigation.navigate('Jelajah', { filterProject: 'true' })}
                />
                <View style={styles.grid2Container}>
                  {projectManga.map((item) => (
                    <MangaCard
                      key={`proj-${item.id || item.slug}`}
                      manga={item}
                      columns={2}
                      showLastChapters={true}
                      isAuthenticated={isAuthenticated}
                      onPress={handleMangaPress}
                      onChapterPress={handleChapterPress}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* 5. UPDATE TERBARU SECTION */}
            {updateTopAds.length > 0 && (
              <AdBanner ads={updateTopAds} columns={1} style={styles.sectionAdBanner} />
            )}
            {latestUpdates.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="Update Terbaru"
                  subtitle="Chapter komik yang baru saja rilis"
                  icon={<Ionicons name="time" size={17} color="#0EA5E9" />}
                  onSeeAll={() => navigation.navigate('Jelajah', { filterOrder: 'Update' })}
                />
                <View style={styles.grid2Container}>
                  {latestUpdates.map((item) => (
                    <MangaCard
                      key={`update-${item.id || item.slug}`}
                      manga={item}
                      columns={2}
                      showLastChapters={true}
                      isAuthenticated={isAuthenticated}
                      onPress={handleMangaPress}
                      onChapterPress={handleChapterPress}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* 6. MANHWA SECTION (KOMIK KOREA / KR) */}
            {homeManhwaAds.length > 0 && (
              <AdBanner ads={homeManhwaAds} columns={1} style={styles.sectionAdBanner} />
            )}
            {manhwaList.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="MANHWA"
                  subtitle="Komik berwarna asal Korea Selatan (KR)"
                  icon={<Ionicons name="sparkles" size={17} color={COLORS.manhwa} />}
                  onSeeAll={() => navigation.navigate('Jelajah', { filterType: 'Manhwa' })}
                />
                <View style={styles.grid2Container}>
                  {manhwaList.map((item) => (
                    <MangaCard
                      key={`manhwa-${item.id || item.slug}`}
                      manga={item}
                      columns={2}
                      showLastChapters={true}
                      isAuthenticated={isAuthenticated}
                      onPress={handleMangaPress}
                      onChapterPress={handleChapterPress}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* 7. MANGA SECTION (KOMIK JEPANG / JP) */}
            {homeMangaAds.length > 0 && (
              <AdBanner ads={homeMangaAds} columns={1} style={styles.sectionAdBanner} />
            )}
            {mangaList.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="MANGA"
                  subtitle="Komik klasik hitam putih asal Jepang (JP)"
                  icon={<Ionicons name="book" size={17} color={COLORS.manga} />}
                  onSeeAll={() => navigation.navigate('Jelajah', { filterType: 'Manga' })}
                />
                <View style={styles.grid2Container}>
                  {mangaList.map((item) => (
                    <MangaCard
                      key={`manga-${item.id || item.slug}`}
                      manga={item}
                      columns={2}
                      showLastChapters={true}
                      isAuthenticated={isAuthenticated}
                      onPress={handleMangaPress}
                      onChapterPress={handleChapterPress}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* 8. MANHUA SECTION (KOMIK CHINA / CN) */}
            {homeManhuaAds.length > 0 && (
              <AdBanner ads={homeManhuaAds} columns={1} style={styles.sectionAdBanner} />
            )}
            {manhuaList.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title="MANHUA"
                  subtitle="Komik kultivasi & aksi asal Tiongkok (CN)"
                  icon={<Ionicons name="layers" size={17} color={COLORS.manhua} />}
                  onSeeAll={() => navigation.navigate('Jelajah', { filterType: 'Manhua' })}
                />
                <View style={styles.grid2Container}>
                  {manhuaList.map((item) => (
                    <MangaCard
                      key={`manhua-${item.id || item.slug}`}
                      manga={item}
                      columns={2}
                      showLastChapters={true}
                      isAuthenticated={isAuthenticated}
                      onPress={handleMangaPress}
                      onChapterPress={handleChapterPress}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Home Footer Ads (Sama seperti Web) */}
            {homeFooterAds.length > 0 && (
              <AdBanner ads={homeFooterAds} columns={1} style={styles.footerAdBanner} />
            )}
          </>
        )}
      </ScrollView>

      {/* Home Popup Announcement Banner - di-hide di mobile sesuai permintaan */}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.background,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerLogo: {
    width: 140,
    height: 35,
  },
  userHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  userAvatarBox: {
    position: 'relative',
    marginRight: 10,
  },
  userAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  userAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  userAvatarInitial: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  vipBadgeDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D97706',
    borderWidth: 1.5,
    borderColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userNameWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  userGreetingName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  userGreetingWave: {
    fontSize: 17,
    marginLeft: 4,
    flexShrink: 0,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl * 2,
  },
  loadingContainer: {
    paddingVertical: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: SPACING.md,
  },

  // 1. HERO BANNER STYLES
  heroSectionWrapper: {
    paddingTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  bannerSliderContainer: {
    position: 'relative',
    width: '100%',
  },
  bannerNavBtn: {
    position: 'absolute',
    top: '40%',
    zIndex: 25,
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  bannerNavBtnLeft: {
    left: 20,
  },
  bannerNavBtnRight: {
    right: 20,
  },
  bannerList: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  bannerCard: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerTopBadges: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seriesBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm - 2,
  },
  seriesBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.sm - 2,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  ratingBadgeText: {
    color: COLORS.star,
    fontSize: 10,
    fontWeight: '800',
  },
  bannerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    justifyContent: 'flex-end',
  },
  bannerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  readNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    gap: 5,
  },
  readNowBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bannerDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  bannerDotActive: {
    width: 18,
    backgroundColor: COLORS.primary,
  },

  // 2. POPULAR SLIDES STYLES
  popularSectionWrapper: {
    marginVertical: SPACING.md,
  },
  popularHeaderCenter: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  popularHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121A',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.35)',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    gap: 6,
  },
  popularFireIcon: {
    fontSize: 14,
  },
  popularHeaderText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  popularSliderWrapper: {
    position: 'relative',
    width: '100%',
  },
  popularNavBtn: {
    position: 'absolute',
    top: '40%',
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularNavBtnLeft: {
    left: 8,
  },
  popularNavBtnRight: {
    right: 8,
  },
  popularSlidesContainer: {
    paddingLeft: POPULAR_SIDE_PADDING,
    paddingRight: POPULAR_SIDE_PADDING,
    paddingVertical: SPACING.md,
  },
  popularSlideCard: {
    width: POPULAR_CARD_WIDTH,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: '#1E1E26',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  popularSlideCardActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 10,
    opacity: 1,
    transform: [{ scale: 1.02 }],
  },
  popularSlideCardInactive: {
    borderColor: 'transparent',
    borderWidth: 2,
    opacity: 0.55,
    transform: [{ scale: 0.96 }],
  },
  popularCardCoverWrapper: {
    width: '100%',
    aspectRatio: 2 / 3,
    position: 'relative',
    backgroundColor: '#0F121C',
  },
  popularCardCover: {
    width: '100%',
    height: '100%',
  },
  popularCoverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
  },
  slideRankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.sm - 2,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  slideRankText: {
    fontSize: 10,
    fontWeight: '900',
  },
  rankGold: {
    backgroundColor: '#F59E0B',
  },
  rankSilver: {
    backgroundColor: '#94A3B8',
  },
  rankBronze: {
    backgroundColor: '#B45309',
  },
  rankDefault: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  popularCardFooter: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    justifyContent: 'center',
    backgroundColor: '#1E1E26',
  },
  popularCardTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  popularMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  popularChapterText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  popularRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  popularRatingVal: {
    color: COLORS.star,
    fontSize: 11,
    fontWeight: '700',
  },

  // SECTIONS
  section: {
    marginBottom: SPACING.lg,
  },
  horizontalList: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  grid2Container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  placeholderCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionAdBanner: {
    marginVertical: SPACING.xs,
  },
  footerAdBanner: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  popupContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: 380,
    maxHeight: height * 0.8,
  },
  popupScrollView: {
    width: '100%',
  },
  popupScrollContent: {
    alignItems: 'center',
    width: '100%',
  },
  popupCloseBtn: {
    position: 'absolute',
    top: -14,
    right: -10,
    zIndex: 50,
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    backgroundColor: '#7F1D1D',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
  },
});

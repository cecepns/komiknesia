import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Share,
  TextInput,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiClient, getImageUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { isChapterAccessLocked } from '../utils/chapterAccess';
import { downloadManager } from '../utils/downloadManager';
import { unityAdsService } from '../services/unityAds';
import { UnityRewardAdModal } from '../components/UnityRewardAdModal';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { ChapterItem } from '../components/ChapterItem';
import { ChapterAccessModal } from '../components/ChapterAccessModal';
import { AdBanner } from '../components/AdBanner';
import { useAds } from '../hooks/useAds';
import { REACTION_OPTIONS, emptyReactionCounts, sumReactionCounts } from '../constants/reactions';

const { width } = Dimensions.get('window');
const ITEMS_PER_PAGE = 10;

export const MangaDetailScreen = ({ navigation, route }) => {
  const { slug } = route.params || {};
  const { isAuthenticated, user } = useAuth();
  const isVip = isAuthenticated && (!!user?.membership_active || user?.role === 'vip');

  // Ads mirroring web positions
  const { ads: chapterTopAds } = useAds('chapter-top');
  const { ads: listChapterAds } = useAds('list-chapter');
  const { ads: topUpvoteAds } = useAds('top-upvote');

  // Main data states
  const [manga, setManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [lockedChapter, setLockedChapter] = useState(null);
  const [error, setError] = useState(null);

  // States
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkChecking, setBookmarkChecking] = useState(false);
  const [activeTab, setActiveTab] = useState('chapters'); // 'chapters' (Detail Info) | 'rekomendasi'
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'
  const [searchChapter, setSearchChapter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [readChapterSlugs, setReadChapterSlugs] = useState(new Set());

  // Offline Downloads & Unity Ads state
  const [downloadedSlugs, setDownloadedSlugs] = useState(new Set());
  const [downloadingChapters, setDownloadingChapters] = useState({});
  const [unityAdModalVisible, setUnityAdModalVisible] = useState(false);
  const [unityAdType, setUnityAdType] = useState('chapter'); // 'chapter' | 'download'
  const pendingActionRef = useRef(null);

  // Recommendations state
  const [recommendedManga, setRecommendedManga] = useState([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);

  // Reactions state
  const [mangaReactionData, setMangaReactionData] = useState(() => emptyReactionCounts());
  const [selectedMangaReaction, setSelectedMangaReaction] = useState(null);
  const [mangaReactionLoading, setMangaReactionLoading] = useState(false);

  // Modals state
  const [sharePopupOpen, setSharePopupOpen] = useState(false);
  const [readlistPickerOpen, setReadlistPickerOpen] = useState(false);
  const [readlists, setReadlists] = useState([]);
  const [readlistsLoading, setReadlistsLoading] = useState(false);
  const [newReadlistTitle, setNewReadlistTitle] = useState('');
  const [creatingNewReadlist, setCreatingNewReadlist] = useState(false);
  const [readlistAddSubmitting, setReadlistAddSubmitting] = useState(null);

  const discordInviteUrl = 'https://discord.gg/dgC22PSm9h';
  const donateUrl = 'https://saweria.co/KomikNesia';

  // Load Manga Detail & initial metadata
  const loadDetail = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getMangaDetail(slug);
      if (res?.status && res?.data) {
        setManga(res.data);
        const chList = Array.isArray(res.data.chapters) ? res.data.chapters : [];
        setChapters(chList);
      } else {
        throw new Error('Komik tidak ditemukan atau data tidak valid');
      }

      // Check bookmark status if authenticated
      if (isAuthenticated) {
        apiClient.checkBookmark(slug).then((b) => {
          if (b?.status) setBookmarked(b.bookmarked);
        }).catch(() => {});
      }

      // Load reactions
      apiClient.getVotes(slug).then((v) => {
        if (v?.status && v.data) {
          setMangaReactionData({ ...emptyReactionCounts(), ...v.data });
          setSelectedMangaReaction(v.userVote ?? v.userReaction ?? null);
        }
      }).catch(() => {});

      // Load read chapters from local history
      const history = await storage.getHistory();
      const readSlugs = new Set(
        history.filter((h) => h.mangaSlug === slug).map((h) => h.chapterSlug)
      );
      setReadChapterSlugs(readSlugs);

      // Load downloaded chapters from offline storage
      const downloaded = (await downloadManager?.getDownloadedChapters?.(slug)) || [];
      setDownloadedSlugs(new Set((downloaded || []).map((c) => c.slug)));
    } catch (err) {
      console.warn('Error loading manga detail:', err);
      setError(err.message || 'Gagal memuat komik');
    } finally {
      setLoading(false);
    }
  }, [slug, isAuthenticated]);

  // Refresh downloaded status whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      if (slug && downloadManager?.getDownloadedChapters) {
        downloadManager
          .getDownloadedChapters(slug)
          .then((list) => {
            setDownloadedSlugs(new Set((list || []).map((c) => c.slug)));
          })
          .catch(() => {});
      }
    }, [slug])
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Load recommendations when tab is switched
  useEffect(() => {
    if (activeTab === 'rekomendasi' && manga) {
      const fetchRecommended = async () => {
        try {
          setRecommendedLoading(true);
          const firstGenre = manga.genres?.[0]?.name || (Array.isArray(manga.genres) ? manga.genres[0] : null);
          const res = await apiClient.getContents({
            per_page: 30,
            genre: typeof firstGenre === 'string' ? firstGenre : undefined,
            orderBy: 'Update',
          });
          if (res?.status && Array.isArray(res.data)) {
            const filtered = res.data.filter((item) => item.slug !== slug);
            const shuffled = [...filtered].sort(() => 0.5 - Math.random());
            setRecommendedManga(shuffled.slice(0, 12));
          }
        } catch (err) {
          console.warn('Error fetching recommendations:', err);
        } finally {
          setRecommendedLoading(false);
        }
      };
      fetchRecommended();
    }
  }, [activeTab, manga, slug]);

  // Load readlists when picker opens
  useEffect(() => {
    if (readlistPickerOpen && isAuthenticated) {
      setReadlistsLoading(true);
      apiClient
        .getReadlists()
        .then((res) => {
          if (res?.status && Array.isArray(res.data)) {
            setReadlists(res.data);
          } else {
            setReadlists([]);
          }
        })
        .catch(() => setReadlists([]))
        .finally(() => setReadlistsLoading(false));
    }
  }, [readlistPickerOpen, isAuthenticated]);

  // Toggle Bookmark
  const toggleBookmark = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Perlu Masuk',
        'Silakan masuk terlebih dahulu untuk menyimpan komik ke bookmark.',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Masuk', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }
    if (bookmarkChecking) return;
    setBookmarkChecking(true);
    try {
      if (bookmarked) {
        await apiClient.removeBookmark(slug);
        setBookmarked(false);
      } else {
        await apiClient.addBookmark(slug);
        setBookmarked(true);
      }
    } catch {
      Alert.alert('Gagal', 'Terjadi kesalahan saat memperbarui bookmark.');
    } finally {
      setBookmarkChecking(false);
    }
  };

  // Open Readlist Picker
  const openReadlistPicker = () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Perlu Masuk',
        'Silakan masuk ke akun kamu untuk menyimpan komik ke readlist.',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Masuk', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }
    setReadlistPickerOpen(true);
  };

  // Add comic to existing readlist
  const addMangaToReadlist = async (readlistId) => {
    if (!slug) return;
    setReadlistAddSubmitting(readlistId);
    try {
      const res = await apiClient.request(`/readlists/${readlistId}/items`, {
        method: 'POST',
        body: { slugs: [slug], slug },
      });
      if (res?.status) {
        Alert.alert('Sukses', 'Komik berhasil ditambahkan ke readlist.');
        setReadlistPickerOpen(false);
      } else {
        Alert.alert('Info', res?.error || 'Komik sudah ada di readlist ini.');
      }
    } catch {
      Alert.alert('Error', 'Gagal menambahkan ke readlist.');
    } finally {
      setReadlistAddSubmitting(null);
    }
  };

  // Create new readlist and add manga
  const handleCreateAndAddReadlist = async () => {
    const title = newReadlistTitle.trim();
    if (!title) {
      Alert.alert('Peringatan', 'Nama readlist tidak boleh kosong.');
      return;
    }
    setCreatingNewReadlist(true);
    try {
      const res = await apiClient.createReadlist(title);
      if (res?.status && res?.data?.id) {
        await apiClient.request(`/readlists/${res.data.id}/items`, {
          method: 'POST',
          body: { slugs: [slug], slug },
        });
        Alert.alert('Sukses', `Readlist "${title}" dibuat & komik ditambahkan!`);
        setNewReadlistTitle('');
        setReadlistPickerOpen(false);
      } else {
        Alert.alert('Error', res?.error || 'Gagal membuat readlist');
      }
    } catch {
      Alert.alert('Error', 'Gagal membuat readlist.');
    } finally {
      setCreatingNewReadlist(false);
    }
  };

  // Submit reaction
  const handleMangaReaction = async (reactionType) => {
    if (!slug || mangaReactionLoading) return;
    setMangaReactionLoading(true);
    try {
      const res = await apiClient.submitVote(slug, reactionType);
      if (res?.status) {
        setSelectedMangaReaction(reactionType);
        const refresh = await apiClient.getVotes(slug);
        if (refresh?.status && refresh.data) {
          setMangaReactionData({ ...emptyReactionCounts(), ...refresh.data });
        }
      }
    } catch (err) {
      console.warn('Reaction error:', err);
    } finally {
      setMangaReactionLoading(false);
    }
  };

  // Open Chapter with login check and Unity Ads (every 5x)
  const openChapter = async (chapter) => {
    if (!chapter) return;
    const isLocked = isChapterAccessLocked(chapters, chapter.slug, isAuthenticated);
    if (isLocked) {
      setLockedChapter(chapter);
      setAccessModalVisible(true);
      return;
    }

    const proceedToReader = () => {
      navigation.navigate('ChapterReader', {
        chapterSlug: chapter.slug,
        mangaSlug: slug,
        mangaTitle: manga?.title,
      });
    };

    // Iklan Reward (Kelipatan 5x, bypass for VIP)
    try {
      const adCheck = await unityAdsService.trackChapterRead(isVip);
      if (adCheck?.shouldShow) {
        pendingActionRef.current = proceedToReader;
        setUnityAdType('chapter');
        setUnityAdModalVisible(true);
        return;
      }
    } catch {}

    proceedToReader();
  };

  // Download Chapter directly to device internal storage for offline reading
  const handleDownloadOfflineChapter = async (chapter) => {
    if (!chapter?.slug || !manga) return;

    if (downloadedSlugs.has(chapter.slug)) {
      Alert.alert(
        'Sudah Tersimpan di HP',
        `Chapter ${chapter.number || chapter.title || ''} sudah ada di memori internal HP dan siap dibaca offline. Ingin buka sekarang?`,
        [
          { text: 'Tutup', style: 'cancel' },
          {
            text: 'Buka Unduhan',
            onPress: () => navigation.navigate('MainTabs', { screen: 'Unduhan' }),
          },
          {
            text: 'Baca Sekarang',
            onPress: () => {
              navigation.navigate('ChapterReader', {
                chapterSlug: chapter.slug,
                mangaSlug: slug,
                mangaTitle: manga?.title,
                isOffline: true,
              });
            },
          },
        ]
      );
      return;
    }

    const startDownload = async () => {
      setDownloadingChapters((prev) => ({ ...prev, [chapter.slug]: true }));
      try {
        await downloadManager.downloadChapter({
          manga: {
            slug,
            title: manga.title,
            cover: manga.cover || manga.image || manga.thumbnail,
          },
          chapter: {
            slug: chapter.slug,
            number: chapter.number || chapter.chapter_number,
            title: chapter.title,
          },
        });

        setDownloadedSlugs((prev) => new Set([...prev, chapter.slug]));
        Alert.alert(
          'Unduhan Berhasil! 🎉',
          `Chapter ${chapter.number || chapter.title || ''} tersimpan di penyimpanan HP kamu. Kamu sekarang bisa membacanya tanpa koneksi internet / offline di tab Unduhan!`,
          [
            { text: 'Oke', style: 'cancel' },
            {
              text: 'Buka Unduhan',
              onPress: () => navigation.navigate('MainTabs', { screen: 'Unduhan' }),
            },
          ]
        );
      } catch (err) {
        console.warn('Download error:', err);
        Alert.alert(
          'Gagal Mengunduh',
          err.message || 'Terjadi kesalahan saat mengunduh gambar chapter ke penyimpanan internal.'
        );
      } finally {
        setDownloadingChapters((prev) => {
          const next = { ...prev };
          delete next[chapter.slug];
          return next;
        });
      }
    };

    // Iklan Reward (Kelipatan 5x, bypass for VIP)
    try {
      const adCheck = await unityAdsService.trackDownload(isVip);
      if (adCheck?.shouldShow) {
        pendingActionRef.current = startDownload;
        setUnityAdType('download');
        setUnityAdModalVisible(true);
        return;
      }
    } catch {}

    startDownload();
  };

  const handleUnityAdReward = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setUnityAdModalVisible(false);
    if (typeof action === 'function') {
      setTimeout(() => {
        action();
      }, 300);
    }
  };

  const handleUnityAdClose = () => {
    pendingActionRef.current = null;
    setUnityAdModalVisible(false);
  };

  // Download PDF
  const handleDownloadPdf = (chapter) => {
    if (!chapter?.slug) return;
    const pdfUrl = `https://backend.komiknesia.asia/api/v1/chapters/slug/${encodeURIComponent(chapter.slug)}/download-pdf`;
    Linking.openURL(pdfUrl).catch(() => {
      Alert.alert('Download PDF', 'Fitur unduh PDF tersedia untuk member. Silakan buka website untuk unduhan offline.');
    });
  };

  // Share Actions
  const mangaShareUrl = `https://komiknesia.asia/komik/${slug}`;

  const handleShareWhatsApp = () => {
    setSharePopupOpen(false);
    const text = encodeURIComponent(`Baca komik ${manga?.title || ''} di KomikNesia: ${mangaShareUrl}`);
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => {
      Linking.openURL(`https://api.whatsapp.com/send?text=${text}`);
    });
  };

  const handleShareTwitter = () => {
    setSharePopupOpen(false);
    const text = encodeURIComponent(`Baca ${manga?.title || ''} Bahasa Indonesia di KomikNesia: ${mangaShareUrl}`);
    Linking.openURL(`https://twitter.com/intent/tweet?text=${text}`);
  };

  const handleShareTelegram = () => {
    setSharePopupOpen(false);
    const text = encodeURIComponent(`Baca komik ${manga?.title || ''} di KomikNesia`);
    Linking.openURL(`https://t.me/share/url?url=${encodeURIComponent(mangaShareUrl)}&text=${text}`);
  };

  const handleNativeShare = async () => {
    setSharePopupOpen(false);
    try {
      await Share.share({
        message: `Baca komik ${manga?.title || ''} di KomikNesia! ${mangaShareUrl}`,
        url: mangaShareUrl,
      });
    } catch {}
  };

  // Filter & sort chapters
  const filteredChapters = useMemo(() => {
    const list = Array.isArray(chapters) ? chapters : [];
    return list
      .filter((ch) => {
        if (!ch) return false;
        if (!searchChapter.trim()) return true;
        const q = searchChapter.trim().toLowerCase();
        const num = String(ch.number || ch.chapter_number || '');
        const title = String(ch.title || '').toLowerCase();
        return num.includes(q) || title.includes(q);
      })
      .sort((a, b) => {
        const numA = parseFloat(a?.number || a?.chapter_number) || 0;
        const numB = parseFloat(b?.number || b?.chapter_number) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [chapters, searchChapter, sortOrder]);

  // Pagination calculation (10 items per page matching web)
  const totalPages = Math.max(1, Math.ceil(filteredChapters.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedChapters = filteredChapters.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchChapter, sortOrder]);

  const getPaginationItems = (current, total) => {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const items = [1];
    if (current > 3) items.push('ellipsis-1');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      if (!items.includes(i)) items.push(i);
    }
    if (current < total - 2) items.push('ellipsis-2');
    if (!items.includes(total)) items.push(total);
    return items;
  };

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Memuat komik...</Text>
      </View>
    );
  }

  if (error || !manga) {
    return (
      <SafeAreaView style={styles.centerLoading}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
        <Text style={styles.errorText}>{error || 'Komik tidak ditemukan'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const coverUrl = getImageUrl(manga.cover || manga.image || manga.thumbnail);
  const rating = Number(manga.rating || manga.score || 0).toFixed(1);
  const totalViews = Number(manga.total_views || manga.views || 0).toLocaleString('id-ID');
  const contentType = (manga.content_type || manga.type || 'MANHWA').toUpperCase();
  const status = (manga.status || 'Ongoing').toUpperCase();
  const author = manga.author || manga.artist || 'Tidak diketahui';
  const altTitle = manga.alternative_name || manga.alternative_title || null;

  const firstChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  const latestChapter = chapters.length > 0 ? chapters[0] : null;

  return (
    <View style={styles.container}>
      {/* Header Navigation matching web */}
      <SafeAreaView edges={['top']} style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.navSquareBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.navRightActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
            style={styles.navSquareBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="home-outline" size={19} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Premium')}
            style={styles.navSquareBtnGold}
            activeOpacity={0.8}
          >
            <Ionicons name="diamond" size={17} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Ads Banner (chapter-top) */}
        {chapterTopAds.length > 0 && (
          <View style={styles.topAdWrapper}>
            <AdBanner ads={chapterTopAds} columns={2} containerPadding={0} />
          </View>
        )}

        {/* 1. HERO BANNER & POSTER CARD matching Web */}
        <View style={[styles.heroCard, chapterTopAds.length === 0 && { marginTop: 56 }]}>
          {/* Blurred Background Poster */}
          <Image
            source={{ uri: coverUrl }}
            style={styles.heroBackgroundImg}
            blurRadius={20}
          />
          <LinearGradient
            colors={['rgba(11, 15, 25, 0.45)', 'rgba(11, 15, 25, 0.85)', '#0B0F19']}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.heroInner}>
            {/* Poster 3:4 */}
            <View style={styles.posterWrapper}>
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.posterImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.posterPlaceholder}>
                  <Ionicons name="book-outline" size={36} color={COLORS.textMuted} />
                </View>
              )}
            </View>

            {/* Title & Metadata */}
            <View style={styles.heroMeta}>
              <Text style={styles.heroTitle}>{manga.title}</Text>
              {altTitle ? (
                <Text numberOfLines={2} style={styles.heroAltTitle}>
                  {altTitle}
                </Text>
              ) : null}

              {/* Badges: Type & Status */}
              <View style={styles.heroBadgesRow}>
                <View style={styles.heroTypeBadge}>
                  <Text style={styles.heroTypeBadgeText}>{contentType}</Text>
                </View>
                <View style={styles.heroStatusBadge}>
                  <Text style={styles.heroStatusBadgeText}>{status}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 4 Main Action Buttons in 2x2 Grid matching Web */}
          <View style={styles.heroActionsGrid}>
            <View style={styles.heroActionRow}>
              {/* FIRST CHAPTER */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!firstChapter}
                onPress={() => openChapter(firstChapter)}
                style={[styles.actionBtn, styles.btnRed, !firstChapter && styles.btnDisabled]}
              >
                <Ionicons name="play" size={15} color="#FFF" />
                <Text style={styles.actionBtnText}>FIRST CHAPTER</Text>
              </TouchableOpacity>

              {/* LAST CHAPTER */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!latestChapter}
                onPress={() => openChapter(latestChapter)}
                style={[styles.actionBtn, styles.btnRed, !latestChapter && styles.btnDisabled]}
              >
                <Ionicons name="play" size={15} color="#FFF" />
                <Text style={styles.actionBtnText}>LAST CHAPTER</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroActionRow}>
              {/* BOOKMARK */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={bookmarkChecking}
                onPress={toggleBookmark}
                style={[
                  styles.actionBtn,
                  bookmarked ? styles.btnViolet : styles.btnDarkGlass,
                ]}
              >
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={15}
                  color="#FFF"
                />
                <Text style={styles.actionBtnText}>
                  {bookmarked ? 'BOOKMARKED' : 'BOOKMARK'}
                </Text>
              </TouchableOpacity>

              {/* READLIST */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openReadlistPicker}
                style={[styles.actionBtn, styles.btnDarkGlass]}
              >
                <Ionicons name="list" size={16} color="#FFF" />
                <Text style={styles.actionBtnText}>READLIST</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 2. SECTION LINK ATAS: PREMIUM & SHARE KOMIK matching Web */}
        <View style={styles.topLinksRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Premium')}
            style={styles.topLinkBtn}
          >
            <Ionicons name="diamond" size={17} color="#F59E0B" />
            <Text style={styles.topLinkText}>PREMIUM</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSharePopupOpen(true)}
            style={styles.topLinkBtn}
          >
            <Ionicons name="share-social" size={17} color="#DC2626" />
            <Text style={styles.topLinkText}>SHARE KOMIK</Text>
          </TouchableOpacity>
        </View>

        {/* 4. DETAIL INFO & REKOMENDASI TABS CARD matching Web */}
        <View style={styles.tabCard}>
          {/* Tab Switcher */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setActiveTab('chapters')}
              style={[
                styles.tabBtn,
                activeTab === 'chapters' && styles.tabBtnActive,
              ]}
            >
              <Ionicons
                name="book"
                size={14}
                color={activeTab === 'chapters' ? '#FFF' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'chapters' && styles.tabBtnTextActive,
                ]}
              >
                Detail Info
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setActiveTab('rekomendasi')}
              style={[
                styles.tabBtn,
                activeTab === 'rekomendasi' && styles.tabBtnActive,
              ]}
            >
              <Ionicons
                name="thumbs-up"
                size={14}
                color={activeTab === 'rekomendasi' ? '#FFF' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'rekomendasi' && styles.tabBtnTextActive,
                ]}
              >
                REKOMENDASI
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: DETAIL INFO */}
          {activeTab === 'chapters' && (
            <View style={styles.detailInfoContent}>
              <Text style={styles.seriesInfoHeader}>
                ℹ️ Series Information
              </Text>

              {/* Specs & Rating Box */}
              <View style={styles.specsRow}>
                <View style={styles.specsLeft}>
                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>TYPE</Text>
                    <Text style={styles.specValue}>{contentType}</Text>
                  </View>

                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>STATUS</Text>
                    <Text style={styles.specValue}>{status}</Text>
                  </View>

                  {altTitle ? (
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>ALTERNATIVE TITLES</Text>
                      <Text numberOfLines={2} style={styles.specValueMuted}>
                        {altTitle}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.specItem}>
                    <Text style={styles.specLabel}>AUTHORS</Text>
                    <Text style={styles.specValue}>{author}</Text>
                  </View>

                  {/* Genres with clickable pills */}
                  {Array.isArray(manga.genres) && manga.genres.length > 0 && (
                    <View style={styles.specItem}>
                      <Text style={styles.specLabel}>GENRES</Text>
                      <View style={styles.genresFlex}>
                        {manga.genres.map((g, idx) => {
                          const name = typeof g === 'string' ? g : g.name;
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => {
                                navigation.navigate('MainTabs', {
                                  screen: 'Search',
                                  params: { genre: name },
                                });
                              }}
                              style={styles.genrePill}
                            >
                              <Text style={styles.genrePillText}>{name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>

                {/* Rating & Views Box matching web md:col-span-4 */}
                <View style={styles.ratingViewsBox}>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={18} color="#FBBF24" />
                    <Text style={styles.ratingValueText}>{rating}</Text>
                  </View>
                  <View style={styles.ratingDivider} />
                  <View style={styles.viewsRow}>
                    <Ionicons name="eye-outline" size={17} color="#D1D5DB" />
                    <Text style={styles.viewsValueText}>{totalViews}</Text>
                  </View>
                </View>
              </View>

              {/* Synopsis Section with Show More / Show Less */}
              {manga.sinopsis || manga.synopsis || manga.description ? (
                <View style={styles.synopsisBox}>
                  <Text style={styles.synopsisHeader}>≡ Synopsis</Text>
                  <Text
                    style={styles.synopsisParagraph}
                    numberOfLines={synopsisExpanded ? undefined : 3}
                  >
                    {manga.sinopsis || manga.synopsis || manga.description}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSynopsisExpanded(!synopsisExpanded)}
                    style={styles.synopsisToggleBtn}
                  >
                    <Text style={styles.synopsisToggleText}>
                      {synopsisExpanded ? 'SHOW LESS ▲' : 'SHOW MORE ▼'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {/* TAB 2: REKOMENDASI */}
          {activeTab === 'rekomendasi' && (
            <View style={styles.rekomendasiContent}>
              <Text style={styles.rekomendasiTitle}>Mirip dengan series ini</Text>
              <Text style={styles.rekomendasiSubtitle}>
                Rekomendasi komik seru dengan genre serupa
              </Text>

              {recommendedLoading ? (
                <View style={styles.rekomendasiLoadingBox}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.rekomendasiLoadingText}>Memuat komik rekomendasi...</Text>
                </View>
              ) : recommendedManga.length === 0 ? (
                <Text style={styles.noRecommendationsText}>
                  Tidak ada rekomendasi komik lain saat ini.
                </Text>
              ) : (
                <View style={styles.recommendationGrid}>
                  {recommendedManga.map((rec) => (
                    <TouchableOpacity
                      key={rec.id || rec.slug}
                      activeOpacity={0.85}
                      onPress={() => {
                        navigation.push('MangaDetail', {
                          slug: rec.slug || rec.id,
                          title: rec.title,
                        });
                      }}
                      style={styles.recCard}
                    >
                      <View style={styles.recCardCoverWrapper}>
                        <Image
                          source={{ uri: getImageUrl(rec.cover || rec.image || rec.thumbnail) }}
                          style={styles.recCardCover}
                          resizeMode="cover"
                        />
                      </View>
                      <View style={styles.recCardBody}>
                        <Text numberOfLines={2} style={styles.recCardTitle}>
                          {rec.title}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 5. LIST CHAPTER SECTION */}
        <View style={styles.chaptersSection}>
          {listChapterAds.length > 0 && (
            <View style={styles.listChapterAdWrapper}>
              <AdBanner ads={listChapterAds} columns={2} containerPadding={0} />
            </View>
          )}

          {/* List Chapter Header with Search Bar & Sort Toggle */}
          <View style={styles.chapterHeaderBox}>
            <View style={styles.chapterHeaderLeft}>
              <Ionicons name="book" size={17} color={COLORS.primary} />
              <Text style={styles.chapterHeaderTitle}>
                List Chapter ({chapters.length})
              </Text>
            </View>

            <View style={styles.chapterHeaderControls}>
              <View style={styles.searchChapterInputWrapper}>
                <Ionicons name="search" size={13} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  placeholder="Cari Chapter..."
                  placeholderTextColor="#6B7280"
                  value={searchChapter}
                  onChangeText={setSearchChapter}
                  style={styles.searchChapterInput}
                />
                {searchChapter ? (
                  <TouchableOpacity onPress={() => setSearchChapter('')}>
                    <Ionicons name="close-circle" size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={styles.sortToggleBtn}
              >
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={16}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Paginated Chapter List */}
          <View style={styles.chapterListContainer}>
            {paginatedChapters.map((ch) => {
              const isLocked = isChapterAccessLocked(chapters, ch.slug, isAuthenticated);
              const isRead = readChapterSlugs.has(ch.slug) || readChapterSlugs.has(ch.id);
              const isLatest = chapters.length > 0 && ch.slug === chapters[0].slug;
              const thumbUrl = getImageUrl(ch.cover || ch.thumbnail || manga.cover);

              return (
                <ChapterItem
                  key={ch.id || ch.slug}
                  chapter={ch}
                  isLocked={isLocked}
                  isRead={isRead}
                  isLatest={isLatest}
                  thumbnailUrl={thumbUrl}
                  views={ch.views || ch.view_count || 0}
                  reactionCount={ch.reaction_count || ch.reactionCount || ch.likes || ch.votes || 0}
                  onPress={() => openChapter(ch)}
                  onDownloadPdf={() => handleDownloadPdf(ch)}
                  onDownloadOffline={() => handleDownloadOfflineChapter(ch)}
                  isDownloaded={downloadedSlugs.has(ch.slug)}
                  isDownloading={!!downloadingChapters[ch.slug]}
                />
              );
            })}
          </View>

          {/* Pagination Navigation matching Web */}
          {totalPages > 1 && (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                disabled={currentPage === 1}
                onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]}
              >
                <Ionicons name="chevron-back" size={16} color="#FFF" />
              </TouchableOpacity>

              {getPaginationItems(currentPage, totalPages).map((item, idx) => {
                if (typeof item === 'string') {
                  return (
                    <Text key={`ellipsis-${idx}`} style={styles.ellipsisText}>
                      ...
                    </Text>
                  );
                }
                const isActive = item === currentPage;
                return (
                  <TouchableOpacity
                    key={`page-${item}`}
                    onPress={() => setCurrentPage(item)}
                    style={[styles.pageNumberBtn, isActive && styles.pageNumberBtnActive]}
                  >
                    <Text
                      style={[
                        styles.pageNumberText,
                        isActive && styles.pageNumberTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]}
              >
                <Ionicons name="chevron-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 6. SECTION LINK BAWAH: DISCORD & DONASI matching Web */}
        <View style={styles.bottomLinksRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => Linking.openURL(discordInviteUrl).catch(() => {})}
            style={styles.bottomLinkBtn}
          >
            <View style={styles.discordIconBadge}>
              <Ionicons name="logo-discord" size={16} color="#FFF" />
            </View>
            <Text style={styles.bottomLinkText}>Discord</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => Linking.openURL(donateUrl).catch(() => {})}
            style={styles.bottomLinkBtn}
          >
            <Ionicons name="heart" size={18} color="#F59E0B" />
            <Text style={styles.bottomLinkText}>Donasi</Text>
          </TouchableOpacity>
        </View>

        {/* 7. REAKSI KOMIK matching Web */}
        <View style={styles.reactionsCard}>
          <Text style={styles.reactionsHeaderTitle}>Reaksi Komik Ini</Text>
          <Text style={styles.reactionsHeaderSubtitle}>
            {sumReactionCounts(mangaReactionData).toLocaleString('id-ID')} reaksi pembaca
          </Text>

          <View style={styles.reactionsGrid}>
            {REACTION_OPTIONS.map((opt) => {
              const isSelected = selectedMangaReaction === opt.id;
              const count = mangaReactionData[opt.id] ?? 0;

              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.75}
                  disabled={mangaReactionLoading}
                  onPress={() => handleMangaReaction(opt.id)}
                  style={[
                    styles.reactionBox,
                    isSelected && styles.reactionBoxSelected,
                  ]}
                >
                  <Text style={styles.reactionEmoji}>{opt.emoji}</Text>
                  <Text style={styles.reactionLabel}>{opt.label}</Text>
                  <Text style={[styles.reactionCount, isSelected && { color: '#FFF' }]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 9. BOTTOM ADS BANNER (top-upvote) */}
        {topUpvoteAds.length > 0 && (
          <View style={styles.bottomAdWrapper}>
            <AdBanner ads={topUpvoteAds} columns={2} containerPadding={0} />
          </View>
        )}
      </ScrollView>

      {/* SHARE MODAL matching Web */}
      {sharePopupOpen && (
        <Modal
          visible={sharePopupOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSharePopupOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.shareModalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Bagikan Komik Ini</Text>
                <TouchableOpacity
                  onPress={() => setSharePopupOpen(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Pilih cara membagikan tautan komik ini ke teman atau media sosial kamu.
              </Text>

              <View style={styles.shareButtonsList}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleShareWhatsApp}
                  style={styles.shareBtnRow}
                >
                  <View style={[styles.shareIconBox, { backgroundColor: '#25D366' }]}>
                    <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
                  </View>
                  <Text style={styles.shareBtnLabel}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleShareTwitter}
                  style={styles.shareBtnRow}
                >
                  <View style={[styles.shareIconBox, { backgroundColor: '#000' }]}>
                    <Ionicons name="logo-twitter" size={20} color="#FFF" />
                  </View>
                  <Text style={styles.shareBtnLabel}>X (Twitter)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleShareTelegram}
                  style={styles.shareBtnRow}
                >
                  <View style={[styles.shareIconBox, { backgroundColor: '#229ED9' }]}>
                    <Ionicons name="paper-plane" size={18} color="#FFF" />
                  </View>
                  <Text style={styles.shareBtnLabel}>Telegram</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleNativeShare}
                  style={styles.shareBtnRow}
                >
                  <View style={[styles.shareIconBox, { backgroundColor: '#4B5563' }]}>
                    <Ionicons name="copy-outline" size={18} color="#FFF" />
                  </View>
                  <Text style={styles.shareBtnLabel}>Salin / Bagikan Lainnya</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* READLIST PICKER MODAL matching Web */}
      {readlistPickerOpen && (
        <Modal
          visible={readlistPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setReadlistPickerOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.readlistModalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.readlistModalTitleWrap}>
                  <View style={styles.readlistIconPill}>
                    <Ionicons name="list" size={16} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Simpan ke Readlist</Text>
                    <Text numberOfLines={1} style={styles.readlistMangaSubtitle}>
                      {manga.title}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setReadlistPickerOpen(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* Buat Readlist Baru */}
              <View style={styles.createReadlistRow}>
                <TextInput
                  placeholder="Nama readlist baru..."
                  placeholderTextColor="#6B7280"
                  value={newReadlistTitle}
                  onChangeText={setNewReadlistTitle}
                  style={styles.createReadlistInput}
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={creatingNewReadlist || !newReadlistTitle.trim()}
                  onPress={handleCreateAndAddReadlist}
                  style={[
                    styles.createReadlistBtn,
                    (!newReadlistTitle.trim() || creatingNewReadlist) && { opacity: 0.5 },
                  ]}
                >
                  {creatingNewReadlist ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.createReadlistBtnText}>Buat</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.readlistSubheading}>Daftar Readlist Kamu</Text>

              <ScrollView style={styles.readlistsScrollView}>
                {readlistsLoading ? (
                  <View style={{ paddingVertical: 20 }}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : readlists.length === 0 ? (
                  <Text style={styles.emptyReadlistText}>
                    Belum ada readlist. Ketik nama di atas untuk membuat readlist pertama.
                  </Text>
                ) : (
                  readlists.map((rl) => {
                    const isSubmitting = readlistAddSubmitting === rl.id;
                    return (
                      <TouchableOpacity
                        key={rl.id}
                        activeOpacity={0.8}
                        disabled={isSubmitting}
                        onPress={() => addMangaToReadlist(rl.id)}
                        style={styles.readlistItemRow}
                      >
                        <Text numberOfLines={1} style={styles.readlistItemTitle}>
                          {rl.title}
                        </Text>
                        <View style={styles.addReadlistPill}>
                          <Text style={styles.addReadlistPillText}>
                            {isSubmitting ? '...' : '+ Tambah'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Custom Access Modal for Locked Chapters (< 2 hours) */}
      <ChapterAccessModal
        visible={accessModalVisible}
        chapter={lockedChapter}
        manga={manga}
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

      {/* Unity Rewarded Ad Modal (5x chapter read, 3x download) */}
      <UnityRewardAdModal
        visible={unityAdModalVisible}
        type={unityAdType}
        onClose={handleUnityAdClose}
        onReward={handleUnityAdReward}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  centerLoading: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: SPACING.md,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl * 2,
  },

  // Floating Header Bar
  navBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  navSquareBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  navSquareBtnGold: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  // Top Ads Wrapper
  topAdWrapper: {
    marginTop: 54,
    paddingHorizontal: SPACING.md,
    marginBottom: 0,
  },

  // 1. HERO BANNER & POSTER CARD
  heroCard: {
    marginHorizontal: SPACING.md,
    marginTop: 8,
    borderRadius: RADIUS.xxl,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: SPACING.lg,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  heroBackgroundImg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.25,
  },
  heroInner: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
    zIndex: 10,
  },
  posterWrapper: {
    width: 120,
    aspectRatio: 3 / 4,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  posterImg: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
    marginBottom: 4,
  },
  heroAltTitle: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTypeBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.md,
  },
  heroTypeBadgeText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heroStatusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.md,
  },
  heroStatusBadgeText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // 4 Main Action Buttons
  heroActionsGrid: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
    zIndex: 10,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: RADIUS.lg,
  },
  btnRed: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  btnViolet: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  btnDarkGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // 2. SECTION LINK ATAS: PREMIUM & SHARE KOMIK
  topLinksRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  topLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  topLinkText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // 4. DETAIL INFO & REKOMENDASI TABS CARD
  tabCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabSwitcher: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary,
  },
  tabBtnText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#FFF',
    fontWeight: '900',
  },
  detailInfoContent: {
    gap: SPACING.md,
  },
  seriesInfoHeader: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  specsRow: {
    flexDirection: 'column',
    gap: SPACING.md,
  },
  specsLeft: {
    gap: 10,
  },
  specItem: {
    gap: 2,
  },
  specLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  specValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  specValueMuted: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  genresFlex: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  genrePill: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  genrePillText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Rating & Views Box
  ratingViewsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121218',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: SPACING.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingValueText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },
  ratingDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewsValueText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // Synopsis
  synopsisBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: SPACING.md,
    gap: 6,
  },
  synopsisHeader: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  synopsisParagraph: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 18,
  },
  synopsisToggleBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  synopsisToggleText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },

  // Rekomendasi Tab Content
  rekomendasiContent: {
    gap: SPACING.sm,
  },
  rekomendasiTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  rekomendasiSubtitle: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  rekomendasiLoadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 6,
  },
  rekomendasiLoadingText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  noRecommendationsText: {
    color: '#9CA3AF',
    fontSize: 12,
    paddingVertical: 20,
    textAlign: 'center',
  },
  recommendationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  recCard: {
    width: (width - SPACING.md * 4 - SPACING.sm) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recCardCoverWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#0F121C',
  },
  recCardCover: {
    width: '100%',
    height: '100%',
  },
  recCardBody: {
    padding: 8,
  },
  recCardTitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // 5. LIST CHAPTER SECTION
  chaptersSection: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.md,
  },
  listChapterAdWrapper: {
    marginBottom: SPACING.xs,
  },
  chapterHeaderBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  chapterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chapterHeaderTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  chapterHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchChapterInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchChapterInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 12,
    paddingVertical: 0,
  },
  sortToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterListContainer: {
    marginTop: 4,
  },

  // Pagination Row
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.lg,
  },
  pageNavBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNavBtnDisabled: {
    opacity: 0.35,
  },
  pageNumberBtn: {
    minWidth: 32,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pageNumberText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
  },
  pageNumberTextActive: {
    color: '#FFF',
    fontWeight: '900',
  },
  ellipsisText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 4,
  },

  // 6. SECTION LINK BAWAH: DISCORD & DONASI
  bottomLinksRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  bottomLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  discordIconBadge: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    backgroundColor: '#5865F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomLinkText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // 7. REAKSI KOMIK
  reactionsCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: SPACING.md,
    alignItems: 'center',
  },
  reactionsHeaderTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  reactionsHeaderSubtitle: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  reactionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  reactionBox: {
    flex: 1,
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reactionBoxSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
  },
  reactionEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  reactionLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  reactionCount: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '900',
  },

  // 9. BOTTOM ADS
  bottomAdWrapper: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },

  // MODALS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  shareModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalDescription: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: SPACING.md,
    lineHeight: 17,
  },
  shareButtonsList: {
    gap: SPACING.sm,
  },
  shareBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: 10,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shareIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Readlist Modal
  readlistModalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: SPACING.lg,
  },
  readlistModalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  readlistIconPill: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  readlistMangaSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    maxWidth: 200,
  },
  createReadlistRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: SPACING.md,
  },
  createReadlistInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 12,
  },
  createReadlistBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createReadlistBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  readlistSubheading: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  readlistsScrollView: {
    maxHeight: 200,
  },
  emptyReadlistText: {
    color: '#64748B',
    fontSize: 11,
    paddingVertical: 12,
    textAlign: 'center',
  },
  readlistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 6,
  },
  readlistItemTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  addReadlistPill: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  addReadlistPillText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '800',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, getImageUrl } from '../api/client';
import { storage } from '../utils/storage';
import { timeAgo } from '../utils/timeAgo';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { EmptyState } from '../components/EmptyState';
import { AdBanner } from '../components/AdBanner';
import { useAds } from '../hooks/useAds';

const TABS = [
  { id: 'bookmark', label: 'Bookmark', icon: 'bookmark' },
  { id: 'history', label: 'Riwayat', icon: 'time' },
  { id: 'readlist', label: 'Readlist', icon: 'list' },
];

export const LibraryScreen = ({ navigation, route }) => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'bookmark');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Ads mirroring web positions
  const { ads: libraryTopAds } = useAds('library-top');
  const { ads: libraryFooterAds } = useAds('library-footer');

  // Bookmarks
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);

  // History
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Readlist
  const [readlists, setReadlists] = useState([]);
  const [readlistsLoading, setReadlistsLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newReadlistTitle, setNewReadlistTitle] = useState('');
  const [creatingReadlist, setCreatingReadlist] = useState(false);

  // Readlist Detail Modal
  const [selectedReadlist, setSelectedReadlist] = useState(null);
  const [readlistDetailLoading, setReadlistDetailLoading] = useState(false);
  const [readlistDetailModalOpen, setReadlistDetailModalOpen] = useState(false);

  // Load Bookmarks
  const loadBookmarks = useCallback(async () => {
    if (!isAuthenticated) {
      setBookmarks([]);
      return;
    }
    setBookmarksLoading(true);
    try {
      const response = await apiClient.getBookmarks({ page: 1, limit: 50 });
      if (response?.status && Array.isArray(response.data)) {
        setBookmarks(response.data);
      }
    } catch (err) {
      console.warn('Error loading bookmarks:', err);
    } finally {
      setBookmarksLoading(false);
    }
  }, [isAuthenticated]);

  // Load History
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await storage.getHistory();
      setHistoryList(data);
    } catch (err) {
      console.warn('Error loading history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load Readlists
  const loadReadlists = useCallback(async () => {
    if (!isAuthenticated) {
      setReadlists([]);
      return;
    }
    setReadlistsLoading(true);
    try {
      const response = await apiClient.getReadlists();
      if (response?.status && Array.isArray(response.data)) {
        setReadlists(response.data);
      }
    } catch (err) {
      console.warn('Error loading readlists:', err);
    } finally {
      setReadlistsLoading(false);
    }
  }, [isAuthenticated]);

  // Pull to refresh handler across all tabs
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'bookmark') {
        await loadBookmarks();
      } else if (activeTab === 'history') {
        await loadHistory();
      } else if (activeTab === 'readlist') {
        await loadReadlists();
      }
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, loadBookmarks, loadHistory, loadReadlists]);

  useEffect(() => {
    if (activeTab === 'bookmark') {
      loadBookmarks();
    } else if (activeTab === 'history') {
      loadHistory();
    } else if (activeTab === 'readlist') {
      loadReadlists();
    }
  }, [activeTab, loadBookmarks, loadHistory, loadReadlists]);

  // Remove Bookmark
  const handleRemoveBookmark = (item) => {
    const slugOrId = item.slug || item.manga_id || item.id;
    Alert.alert('Hapus Bookmark', `Hapus "${item.title || item.manga_title}" dari bookmark?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.removeBookmark(slugOrId);
            setBookmarks((prev) => prev.filter((b) => (b.slug || b.manga_id || b.id) !== slugOrId));
          } catch {
            Alert.alert('Gagal', 'Tidak dapat menghapus bookmark');
          }
        },
      },
    ]);
  };

  // Remove History
  const handleRemoveHistoryItem = async (chapterSlug) => {
    const updated = await storage.removeHistoryItem(chapterSlug);
    setHistoryList(updated);
  };

  const handleClearAllHistory = () => {
    Alert.alert('Hapus Riwayat', 'Hapus semua riwayat baca?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus Semua',
        style: 'destructive',
        onPress: async () => {
          await storage.clearHistory();
          setHistoryList([]);
        },
      },
    ]);
  };

  // Create Readlist
  const handleCreateReadlist = async () => {
    const trimmed = newReadlistTitle.trim();
    if (!trimmed) {
      Alert.alert('Peringatan', 'Nama readlist tidak boleh kosong');
      return;
    }

    setCreatingReadlist(true);
    try {
      const response = await apiClient.createReadlist(trimmed);
      if (response?.status && response.data) {
        setReadlists((prev) => [response.data, ...prev]);
        setNewReadlistTitle('');
        setCreateModalOpen(false);
        Alert.alert('Sukses', `Readlist "${trimmed}" berhasil dibuat.`);
      } else {
        Alert.alert('Gagal', response?.error || 'Gagal membuat readlist');
      }
    } catch (err) {
      Alert.alert('Gagal', err.message || 'Terjadi kesalahan');
    } finally {
      setCreatingReadlist(false);
    }
  };

  // Delete Readlist
  const handleDeleteReadlist = (id, title) => {
    Alert.alert('Hapus Readlist', `Apakah kamu yakin ingin menghapus readlist "${title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.deleteReadlist(id);
            setReadlists((prev) => prev.filter((r) => r.id !== id));
            if (selectedReadlist?.id === id) {
              setReadlistDetailModalOpen(false);
              setSelectedReadlist(null);
            }
          } catch {
            Alert.alert('Gagal', 'Tidak dapat menghapus readlist');
          }
        },
      },
    ]);
  };

  // Open Readlist Detail Modal
  const handleOpenReadlistDetail = async (item) => {
    setSelectedReadlist(item);
    setReadlistDetailModalOpen(true);
    setReadlistDetailLoading(true);
    try {
      const res = await apiClient.getReadlist(item.id);
      if (res?.status && res?.data) {
        setSelectedReadlist(res.data);
      }
    } catch (err) {
      console.warn('Error fetching readlist detail:', err);
    } finally {
      setReadlistDetailLoading(false);
    }
  };

  // Remove item from Readlist
  const handleRemoveFromReadlist = async (mangaIdOrSlug, mangaTitle) => {
    if (!selectedReadlist) return;
    Alert.alert('Hapus dari Readlist', `Hapus "${mangaTitle || 'komik'}" dari readlist ini?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.removeReadlistItem(selectedReadlist.id, mangaIdOrSlug);
            setSelectedReadlist((prev) => ({
              ...prev,
              items: (prev?.items || []).filter(
                (m) => m.manga_id !== mangaIdOrSlug && m.slug !== mangaIdOrSlug
              ),
            }));
            setReadlists((prev) =>
              prev.map((r) =>
                r.id === selectedReadlist.id
                  ? { ...r, manga_count: Math.max(0, (r.manga_count || 1) - 1) }
                  : r
              )
            );
          } catch {
            Alert.alert('Gagal', 'Tidak dapat menghapus komik dari readlist.');
          }
        },
      },
    ]);
  };

  const renderRefreshControl = () => (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={COLORS.primary}
      colors={[COLORS.primary]}
    />
  );

  const renderFooterAd = useCallback(() => {
    if (!libraryFooterAds || libraryFooterAds.length === 0) {
      return <View style={styles.footerSpacing} />;
    }
    return (
      <View style={styles.footerContainer}>
        <AdBanner ads={libraryFooterAds} columns={1} style={styles.footerAd} containerPadding={0} />
      </View>
    );
  }, [libraryFooterAds]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Perpustakaan</Text>
          {activeTab === 'history' && historyList.length > 0 && (
            <TouchableOpacity onPress={handleClearAllHistory} style={styles.clearHistoryBtn}>
              <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
              <Text style={styles.clearHistoryText}>Hapus Semua</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'readlist' && isAuthenticated && (
            <TouchableOpacity
              onPress={() => setCreateModalOpen(true)}
              style={styles.addReadlistBtn}
            >
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={styles.addReadlistText}>Buat Baru</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Library Top Ads - DI ATAS TAB NYA */}
        {libraryTopAds?.length > 0 && (
          <AdBanner ads={libraryTopAds} columns={1} style={styles.topAd} containerPadding={0} />
        )}

        {/* Tab Switcher */}
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={isActive ? '#FFF' : COLORS.textSecondary}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tab Contents with Pull-to-Refresh */}
      {activeTab === 'bookmark' && (
        !isAuthenticated ? (
          <FlatList
            data={[]}
            key="empty-auth-bookmark"
            contentContainerStyle={[styles.listContent, styles.emptyListGrow]}
            refreshControl={renderRefreshControl()}
            ListEmptyComponent={
              <EmptyState
                icon="log-in-outline"
                title="Masuk untuk Akses Bookmark"
                description="Simpan dan sinkronkan komik favoritmu di semua perangkat dengan masuk ke akun KomikNesia."
                buttonText="Masuk / Daftar"
                onButtonPress={() => navigation.navigate('Login')}
              />
            }
            ListFooterComponent={renderFooterAd}
          />
        ) : bookmarksLoading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={bookmarks}
            key="grid-bookmark"
            keyExtractor={(item, idx) => `${item.id || item.slug}-${idx}`}
            numColumns={2}
            columnWrapperStyle={bookmarks.length > 0 ? styles.columnWrapper : undefined}
            contentContainerStyle={[
              styles.listContent,
              bookmarks.length === 0 && styles.emptyListGrow,
            ]}
            refreshControl={renderRefreshControl()}
            ListEmptyComponent={
              <EmptyState
                icon="bookmark-outline"
                title="Belum Ada Bookmark"
                description="Kamu belum menyimpan komik apa pun ke daftar bookmark. Tarik ke bawah untuk refresh."
                buttonText="Cari Komik Menarik"
                onButtonPress={() => navigation.navigate('Jelajah')}
              />
            }
            ListFooterComponent={renderFooterAd}
            renderItem={({ item }) => {
              const manga = item.manga || item;
              const coverUrl = getImageUrl(manga.cover || manga.image);
              const title = manga.title || 'Tanpa Judul';
              const slug = manga.slug || item.slug || item.manga_id;
              const latestChapter = manga.latest_chapter_number || manga.latest_chapter?.number;

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('MangaDetail', { slug, title })}
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
                        <Ionicons name="book-outline" size={24} color={COLORS.textMuted} />
                      </View>
                    )}

                    {/* Floating Delete Bookmark */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleRemoveBookmark(item)}
                      style={styles.floatingDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                    </TouchableOpacity>

                    {/* Latest Chapter Pill */}
                    {latestChapter ? (
                      <View style={styles.floatingChapterBadge}>
                        <Text style={styles.floatingChapterText}>Ch. {latestChapter}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.gridCardBody}>
                    <Text numberOfLines={2} style={styles.gridCardTitle}>
                      {title}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )
      )}

      {activeTab === 'history' && (
        historyLoading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={historyList}
            key="grid-history"
            keyExtractor={(item, idx) => `${item.chapterSlug || idx}`}
            numColumns={2}
            columnWrapperStyle={historyList.length > 0 ? styles.columnWrapper : undefined}
            contentContainerStyle={[
              styles.listContent,
              historyList.length === 0 && styles.emptyListGrow,
            ]}
            refreshControl={renderRefreshControl()}
            ListEmptyComponent={
              <EmptyState
                icon="time-outline"
                title="Riwayat Baca Kosong"
                description="Komik yang kamu baca akan otomatis tersimpan di sini. Tarik ke bawah untuk refresh."
                buttonText="Mulai Membaca"
                onButtonPress={() => navigation.navigate('Jelajah')}
              />
            }
            ListFooterComponent={renderFooterAd}
            renderItem={({ item }) => {
              const coverUrl = getImageUrl(item.cover);
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (item.chapterSlug) {
                      navigation.navigate('ChapterReader', {
                        chapterSlug: item.chapterSlug,
                        mangaSlug: item.mangaSlug,
                        mangaTitle: item.mangaTitle,
                      });
                    } else if (item.mangaSlug) {
                      navigation.navigate('MangaDetail', { slug: item.mangaSlug });
                    }
                  }}
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
                        <Ionicons name="book-outline" size={24} color={COLORS.textMuted} />
                      </View>
                    )}

                    {/* Floating Delete History */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleRemoveHistoryItem(item.chapterSlug)}
                      style={styles.floatingDeleteBtn}
                    >
                      <Ionicons name="close" size={13} color="#CBD5E1" />
                    </TouchableOpacity>

                    {/* Chapter Badge */}
                    <View style={styles.floatingChapterBadge}>
                      <Text style={styles.floatingChapterText}>
                        Ch. {item.chapterNumber || '?'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.gridCardBody}>
                    <Text numberOfLines={2} style={styles.gridCardTitle}>
                      {item.mangaTitle || 'Komik'}
                    </Text>
                    <Text style={styles.gridCardTime}>{timeAgo(item.readAt)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )
      )}

      {activeTab === 'readlist' && (
        !isAuthenticated ? (
          <FlatList
            data={[]}
            key="empty-auth-readlist"
            contentContainerStyle={[styles.listContent, styles.emptyListGrow]}
            refreshControl={renderRefreshControl()}
            ListEmptyComponent={
              <EmptyState
                icon="list-outline"
                title="Masuk untuk Kelola Readlist"
                description="Buat daftar koleksi komik kustom sesuai seleramu."
                buttonText="Masuk / Daftar"
                onButtonPress={() => navigation.navigate('Login')}
              />
            }
            ListFooterComponent={renderFooterAd}
          />
        ) : readlistsLoading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={readlists}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[
              styles.listContent,
              readlists.length === 0 && styles.emptyListGrow,
            ]}
            refreshControl={renderRefreshControl()}
            ListEmptyComponent={
              <EmptyState
                icon="folder-open-outline"
                title="Belum Ada Readlist"
                description="Buat koleksi pertamamu untuk mengelompokkan komik favorit. Tarik ke bawah untuk refresh."
                buttonText="Buat Readlist Sekarang"
                onButtonPress={() => setCreateModalOpen(true)}
              />
            }
            ListFooterComponent={renderFooterAd}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.readlistItem}
                activeOpacity={0.8}
                onPress={() => handleOpenReadlistDetail(item)}
              >
                <View style={styles.readlistIconCircle}>
                  <Ionicons name="bookmarks" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.readlistInfo}>
                  <Text style={styles.readlistTitle}>{item.title}</Text>
                  <Text style={styles.readlistCount}>
                    {item.manga_count ?? (item.items?.length || 0)} komik tersimpan • Ketuk untuk lihat
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteReadlist(item.id, item.title)}
                  style={styles.actionBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )
      )}

      {/* Modal Buat Readlist */}
      <Modal
        visible={createModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalBoxTitle}>Buat Readlist Baru</Text>
            <TextInput
              placeholder="Contoh: Manhwa Action Favorit"
              placeholderTextColor={COLORS.textMuted}
              value={newReadlistTitle}
              onChangeText={setNewReadlistTitle}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setCreateModalOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateReadlist}
                disabled={creatingReadlist || !newReadlistTitle.trim()}
                style={[
                  styles.modalSubmitBtn,
                  (!newReadlistTitle.trim() || creatingReadlist) && { opacity: 0.6 },
                ]}
              >
                {creatingReadlist ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Buat</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Detail Isi Readlist */}
      <Modal
        visible={readlistDetailModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReadlistDetailModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.readlistDetailCard}>
            <View style={styles.readlistDetailHeader}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.readlistDetailTitle}>
                  {selectedReadlist?.title || 'Daftar Readlist'}
                </Text>
                <Text style={styles.readlistDetailSubtitle}>
                  {selectedReadlist?.items?.length || 0} komik dalam koleksi ini
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReadlistDetailModalOpen(false)}
                style={styles.modalCloseCircle}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {readlistDetailLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={{ color: COLORS.textMuted, marginTop: 8, fontSize: 12 }}>
                  Memuat komik di readlist...
                </Text>
              </View>
            ) : !selectedReadlist?.items || selectedReadlist.items.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center', paddingHorizontal: 20 }}>
                <Ionicons name="book-outline" size={36} color={COLORS.textMuted} />
                <Text style={{ color: '#D1D5DB', marginTop: 10, fontSize: 13, fontWeight: '700' }}>
                  Belum ada komik di readlist ini
                </Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                  Buka halaman detail komik dan klik "Simpan ke Readlist" untuk menambahkan komik.
                </Text>
              </View>
            ) : (
              <FlatList
                data={selectedReadlist.items}
                keyExtractor={(item, idx) => `${item.manga_id || item.slug}-${idx}`}
                style={{ maxHeight: 380 }}
                contentContainerStyle={{ paddingVertical: 8 }}
                renderItem={({ item }) => {
                  const coverUrl = getImageUrl(item.cover);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setReadlistDetailModalOpen(false);
                        navigation.navigate('MangaDetail', {
                          slug: item.slug,
                          title: item.title,
                        });
                      }}
                      style={styles.readlistDetailItemRow}
                    >
                      <View style={styles.readlistDetailCoverBox}>
                        {coverUrl ? (
                          <Image
                            source={{ uri: coverUrl }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons name="book" size={16} color={COLORS.textMuted} />
                        )}
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text numberOfLines={1} style={styles.readlistDetailItemTitle}>
                          {item.title}
                        </Text>
                        <Text style={styles.readlistDetailItemTime}>
                          Ditambahkan: {timeAgo(item.created_at)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          handleRemoveFromReadlist(item.manga_id || item.slug, item.title)
                        }
                        style={{ padding: 6 }}
                      >
                        <Ionicons name="trash-outline" size={17} color={COLORS.danger} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topAd: {
    marginVertical: SPACING.xs,
  },
  footerContainer: {
    width: '100%',
    paddingTop: SPACING.md,
    paddingBottom: 80,
  },
  footerSpacing: {
    height: 60,
  },
  footerAd: {
    marginVertical: SPACING.xs,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearHistoryText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  addReadlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addReadlistText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 3,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: 6,
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
  gridCardBody: {
    padding: 8,
  },
  gridCardTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  gridCardTime: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 4,
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  coverWrapper: {
    width: 52,
    height: 72,
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
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  chapterBadge: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  historyTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  actionBtn: {
    padding: SPACING.sm,
  },
  readlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  readlistIconCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  readlistInfo: {
    flex: 1,
  },
  readlistTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  readlistCount: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  modalBox: {
    width: '100%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  modalBoxTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: SPACING.md,
  },
  modalInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: SPACING.lg,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#FFF',
    fontWeight: '700',
  },

  // READLIST DETAIL MODAL
  readlistDetailCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#111522',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  readlistDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: SPACING.sm,
  },
  readlistDetailTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  readlistDetailSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  readlistDetailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.md,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  readlistDetailCoverBox: {
    width: 38,
    height: 52,
    borderRadius: RADIUS.xs,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  readlistDetailItemTitle: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  readlistDetailItemTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});

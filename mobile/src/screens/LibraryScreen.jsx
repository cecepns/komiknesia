import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
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
    if (!newReadlistTitle.trim()) return;
    setCreatingReadlist(true);
    try {
      const res = await apiClient.createReadlist(newReadlistTitle.trim());
      if (res?.status) {
        setNewReadlistTitle('');
        setCreateModalOpen(false);
        loadReadlists();
      } else {
        Alert.alert('Gagal', res?.error || 'Gagal membuat readlist');
      }
    } catch (err) {
      Alert.alert('Gagal', err.message || 'Gagal membuat readlist');
    } finally {
      setCreatingReadlist(false);
    }
  };

  // Delete Readlist
  const handleDeleteReadlist = (readlistId, title) => {
    Alert.alert('Hapus Readlist', `Hapus koleksi "${title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.deleteReadlist(readlistId);
            setReadlists((prev) => prev.filter((r) => r.id !== readlistId));
          } catch {
            Alert.alert('Gagal', 'Gagal menghapus readlist');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Perpustakaan</Text>
          {activeTab === 'history' && historyList.length > 0 && (
            <TouchableOpacity onPress={handleClearAllHistory} style={styles.clearHistoryBtn}>
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              <Text style={styles.clearHistoryText}>Hapus</Text>
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

        {/* Tab Buttons */}
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.8}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
              >
                <Ionicons
                  name={isActive ? tab.icon : `${tab.icon}-outline`}
                  size={16}
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

      {/* Library Top Ads (Sama seperti Web) */}
      {libraryTopAds.length > 0 && (
        <AdBanner ads={libraryTopAds} columns={2} style={styles.topAd} />
      )}

      {/* Tab Contents */}
      {activeTab === 'bookmark' && (
        !isAuthenticated ? (
          <EmptyState
            icon="log-in-outline"
            title="Masuk untuk Akses Bookmark"
            description="Simpan dan sinkronkan komik favoritmu di semua perangkat dengan masuk ke akun KomikNesia."
            buttonText="Masuk / Daftar"
            onButtonPress={() => navigation.navigate('Login')}
          />
        ) : bookmarksLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : bookmarks.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="Belum Ada Bookmark"
            description="Kamu belum menyimpan komik apa pun ke daftar bookmark."
            buttonText="Cari Komik Menarik"
            onButtonPress={() => navigation.navigate('Jelajah')}
          />
        ) : (
          <FlatList
            data={bookmarks}
            keyExtractor={(item, idx) => `${item.id || item.slug}-${idx}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const manga = item.manga || item;
              const coverUrl = getImageUrl(manga.cover || manga.image);
              const title = manga.title || 'Tanpa Judul';
              const slug = manga.slug || item.slug || item.manga_id;
              const latestChapter = manga.latest_chapter_number || manga.latest_chapter?.number;

              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('MangaDetail', { slug, title })}
                  style={styles.itemRow}
                >
                  <View style={styles.coverWrapper}>
                    {coverUrl ? (
                      <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.placeholderCover}>
                        <Ionicons name="book-outline" size={20} color={COLORS.textMuted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text numberOfLines={2} style={styles.itemTitle}>{title}</Text>
                    {latestChapter ? (
                      <Text style={styles.chapterBadge}>Ch. {latestChapter}</Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    onPress={() => handleRemoveBookmark(item)}
                    style={styles.actionBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        )
      )}

      {activeTab === 'history' && (
        historyLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : historyList.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="Riwayat Baca Kosong"
            description="Komik yang kamu baca akan otomatis tersimpan di sini."
            buttonText="Mulai Membaca"
            onButtonPress={() => navigation.navigate('Jelajah')}
          />
        ) : (
          <FlatList
            data={historyList}
            keyExtractor={(item, idx) => `${item.chapterSlug || idx}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const coverUrl = getImageUrl(item.cover);
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
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
                  style={styles.itemRow}
                >
                  <View style={styles.coverWrapper}>
                    {coverUrl ? (
                      <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.placeholderCover}>
                        <Ionicons name="book-outline" size={20} color={COLORS.textMuted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text numberOfLines={1} style={styles.itemTitle}>{item.mangaTitle}</Text>
                    <Text style={styles.chapterBadge}>
                      Terakhir dibaca: Ch. {item.chapterNumber || '?'}
                    </Text>
                    <Text style={styles.historyTime}>{timeAgo(item.readAt)}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleRemoveHistoryItem(item.chapterSlug)}
                    style={styles.actionBtn}
                  >
                    <Ionicons name="close" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        )
      )}

      {activeTab === 'readlist' && (
        !isAuthenticated ? (
          <EmptyState
            icon="list-outline"
            title="Masuk untuk Kelola Readlist"
            description="Buat daftar koleksi komik kustom sesuai seleramu."
            buttonText="Masuk / Daftar"
            onButtonPress={() => navigation.navigate('Login')}
          />
        ) : readlistsLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : readlists.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title="Belum Ada Readlist"
            description="Buat koleksi pertamamu untuk mengelompokkan komik favorit."
            buttonText="Buat Readlist Sekarang"
            onButtonPress={() => setCreateModalOpen(true)}
          />
        ) : (
          <FlatList
            data={readlists}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.readlistItem}>
                <View style={styles.readlistIconCircle}>
                  <Ionicons name="bookmarks" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.readlistInfo}>
                  <Text style={styles.readlistTitle}>{item.title}</Text>
                  <Text style={styles.readlistCount}>
                    {item.items?.length || 0} komik tersimpan
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteReadlist(item.id, item.title)}
                  style={styles.actionBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            )}
          />
        )
      )}

      {/* Library Footer Ads (Sama seperti Web) */}
      {libraryFooterAds.length > 0 && (
        <AdBanner ads={libraryFooterAds} columns={2} style={styles.footerAd} />
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
});

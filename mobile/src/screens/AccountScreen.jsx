import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { downloadManager } from '../utils/downloadManager';
import { apiClient, getImageUrl } from '../api/client';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { formatDate } from '../utils/timeAgo';

export const AccountScreen = ({ navigation }) => {
  const { user, isAuthenticated, logout, updateProfile, refreshUser } = useAuth();

  // Statistics & Storage
  const [historyCount, setHistoryCount] = useState(0);
  const [downloadCount, setDownloadCount] = useState(0);
  const [cacheSizeStr, setCacheSizeStr] = useState('2.4 MB');

  // Edit Profile Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  // CS Modal
  const [csModalOpen, setCsModalOpen] = useState(false);
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('https://komiknesia.id');

  useEffect(() => {
    let isMounted = true;
    apiClient.getContactInfo(true).then((res) => {
      if (isMounted && res?.whatsapp) {
        const raw = String(res.whatsapp).trim();
        if (raw && raw !== '-') {
          setAdminWhatsapp(raw);
        }
      }
    }).catch(() => {});

    apiClient.getSettings().then((res) => {
      if (isMounted && (res?.website_url || res?.web_url)) {
        setWebsiteUrl(res.website_url || res.web_url);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const cleanPhone = useMemo(() => {
    if (!adminWhatsapp) return '';
    const trimmed = adminWhatsapp.trim();
    if (!trimmed || trimmed === '-') return '';
    let digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    return digits;
  }, [adminWhatsapp]);

  const loadAccountData = useCallback(async () => {
    try {
      const [hList, dlStorage] = await Promise.all([
        storage.getHistory(),
        downloadManager.getTotalStorageInfo(),
      ]);
      setHistoryCount(hList.length);
      setDownloadCount(dlStorage.totalChapters);
    } catch {}
  }, []);

  useEffect(() => {
    loadAccountData();
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
    }
  }, [user, loadAccountData]);

  // Clear Cache Action
  const handleClearCache = () => {
    Alert.alert(
      'Bersihkan Cache Aplikasi',
      'Hapus file cache sementara dan riwayat baca lokal untuk membebaskan ruang memori HP?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Bersihkan',
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.clearHistory();
              setHistoryCount(0);
              setCacheSizeStr('0 MB');
              Alert.alert('Sukses', 'Data cache sementara aplikasi berhasil dibersihkan.');
            } catch {
              Alert.alert('Gagal', 'Terjadi kesalahan saat membersihkan cache.');
            }
          },
        },
      ]
    );
  };

  // Logout Action
  const handleLogout = () => {
    Alert.alert('Keluar dari Akun', 'Apakah kamu yakin ingin keluar dari akun KomikNesia?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  // Save Profile Edit
  const handleSaveProfile = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Peringatan', 'Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setUpdating(true);
    try {
      const payload = {
        name: name.trim(),
        bio: bio.trim(),
      };
      if (currentPassword && newPassword) {
        payload.current_password = currentPassword;
        payload.password = newPassword;
      }

      const res = await updateProfile(payload);
      if (res?.success) {
        Alert.alert('Sukses', 'Profil berhasil diperbarui!');
        setEditModalOpen(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        refreshUser();
      } else {
        Alert.alert('Gagal', res?.error || 'Gagal memperbarui profil.');
      }
    } catch (err) {
      Alert.alert('Gagal', err.message || 'Gagal memperbarui profil.');
    } finally {
      setUpdating(false);
    }
  };

  const avatarUrl = user?.avatar || user?.profile_image ? getImageUrl(user.avatar || user.profile_image) : null;
  const isVip = !!user?.membership_active || user?.role === 'vip';
  const membershipType = (user?.membership_type || '').toLowerCase();
  const isMobileVip = isVip && (!membershipType || membershipType === 'mobile' || membershipType === 'both');
  const joinDate = user?.created_at ? formatDate(user.created_at) : 'Baru bergabung';

  const getVipBadgeLabel = () => {
    if (!isVip) return isAuthenticated ? 'Member Reguler' : 'Tamu (Guest)';
    if (membershipType === 'mobile') return '📱 VIP Mobile';
    if (membershipType === 'both') return '👑 VIP Web & Mobile';
    if (membershipType === 'web') return '🌐 VIP Web (Web Saja)';
    return '👑 VIP Premium';
  };

  const getVipPillLabel = () => {
    if (membershipType === 'mobile') return 'VIP MOBILE';
    if (membershipType === 'both') return 'VIP ALL';
    if (membershipType === 'web') return 'VIP WEB';
    return 'VIP';
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.topHeaderTitle}>Akun</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 1. PHOTO PROFIL & USER HEADER */}
        {isAuthenticated && user ? (
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              {/* Photo Profil */}
              <View style={styles.avatarWrapper}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {(user.name || user.username || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                {isVip && (
                  <View style={styles.crownBadge}>
                    <Ionicons name="sparkles" size={10} color="#FFF" />
                  </View>
                )}
              </View>

              {/* User Info */}
              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text numberOfLines={1} style={styles.userName}>
                    {user.name || user.username}
                  </Text>
                  {isVip && (
                    <View style={styles.vipTag}>
                      <Text style={styles.vipTagText}>{getVipPillLabel()}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userHandle}>@{user.username}</Text>
                {user.email ? <Text numberOfLines={1} style={styles.userEmail}>{user.email}</Text> : null}
              </View>

              {/* Edit Button */}
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditModalOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={15} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {user.bio ? <Text style={styles.userBio}>{user.bio}</Text> : null}
          </View>
        ) : (
          /* Guest Photo Profil & Prompt */
          <View style={styles.guestCard}>
            <View style={styles.guestAvatarCircle}>
              <Ionicons name="person-outline" size={32} color={COLORS.textMuted} />
            </View>
            <View style={styles.guestTextCol}>
              <Text style={styles.guestTitle}>Pengunjung (Tamu)</Text>
              <Text style={styles.guestDesc}>
                Masuk untuk sinkronisasi bookmark, riwayat baca, dan akses fitur VIP.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.guestLoginBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.8}
            >
              <Text style={styles.guestLoginBtnText}>Masuk</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. KOMIKNESIA PREMIUM CARD */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Premium')}
          style={styles.premiumBannerCard}
        >
          <LinearGradient
            colors={['#D97706', '#92400E', '#451A03']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumGradient}
          >
            <View style={styles.premiumLeft}>
              <View style={styles.premiumCrownBox}>
                <Ionicons name="diamond" size={24} color="#FDE68A" />
              </View>
              <View style={styles.premiumTextCol}>
                <View style={styles.premiumBadgeRow}>
                  <Text style={styles.premiumTitle}>KomikNesia Premium</Text>
                  <View style={styles.vipPillMini}>
                    <Text style={styles.vipPillMiniText}>VIP</Text>
                  </View>
                </View>
                <Text style={styles.premiumSubtitle}>
                  No Iklan • Auto Scroll • Unduh Sepuasnya • Rilis Lebih Awal
                </Text>
              </View>
            </View>

            <View style={styles.premiumArrowBox}>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* 3. INFORMASI AKUN */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Informasi Akun</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelCol}>
                <Ionicons name="person-circle-outline" size={18} color={COLORS.textMuted} />
                <Text style={styles.infoLabel}>Status Pengguna</Text>
              </View>
              <View style={[styles.statusBadge, isVip ? styles.statusBadgeVip : styles.statusBadgeNormal]}>
                <Text style={[styles.statusBadgeText, isVip ? styles.statusBadgeVipText : styles.statusBadgeNormalText]}>
                  {getVipBadgeLabel()}
                </Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelCol}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} />
                <Text style={styles.infoLabel}>Bergabung Sejak</Text>
              </View>
              <Text style={styles.infoVal}>{isAuthenticated ? joinDate : '-'}</Text>
            </View>

            {isAuthenticated && user?.email && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelCol}>
                    <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
                    <Text style={styles.infoLabel}>Email Terdaftar</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.infoVal}>{user.email}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 4. MENU AKTIVITAS & PERPUSTAKAAN */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Aktivitas Saya</Text>

          {/* Bookmark */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Library', params: { initialTab: 'bookmark' } })}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(220, 38, 38, 0.15)' }]}>
              <Ionicons name="bookmark" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.menuItemTextCol}>
              <Text style={styles.menuItemText}>Bookmark</Text>
              <Text style={styles.menuItemSubtext}>Daftar komik favorit yang kamu simpan</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Riwayat */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Library', params: { initialTab: 'history' } })}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="time" size={18} color="#3B82F6" />
            </View>
            <View style={styles.menuItemTextCol}>
              <Text style={styles.menuItemText}>Riwayat</Text>
              <Text style={styles.menuItemSubtext}>{historyCount} chapter baru dibaca</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Unduhan Saya */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Unduhan' })}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="download" size={18} color="#10B981" />
            </View>
            <View style={styles.menuItemTextCol}>
              <Text style={styles.menuItemText}>Unduhan Saya</Text>
              <Text style={styles.menuItemSubtext}>{downloadCount} chapter tersimpan di HP (Bisa Offline)</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 5. APLIKASI & BANTUAN */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Bantuan & Pengaturan</Text>

          {/* Clear Cache */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={handleClearCache}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </View>
            <View style={styles.menuItemTextCol}>
              <Text style={styles.menuItemText}>Clear Cache Aplikasi</Text>
              <Text style={styles.menuItemSubtext}>Bersihkan memori sementara ({cacheSizeStr})</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Customer Service */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.75}
            onPress={() => setCsModalOpen(true)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
              <Ionicons name="headset-outline" size={18} color="#22C55E" />
            </View>
            <View style={styles.menuItemTextCol}>
              <Text style={styles.menuItemText}>Customer Service</Text>
              <Text style={styles.menuItemSubtext}>
                {cleanPhone.length >= 8
                  ? 'Hubungi admin via WhatsApp & Komunitas'
                  : 'Bantuan & Komunitas KomikNesia'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 6. LOGIN OR LOGOUT BUTTON */}
        <View style={styles.authSection}>
          {isAuthenticated ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleLogout}
              style={styles.logoutButton}
            >
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text style={styles.logoutButtonText}>Keluar dari Akun</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Login')}
              style={styles.loginPrimaryBtn}
            >
              <Ionicons name="log-in-outline" size={18} color="#FFF" />
              <Text style={styles.loginPrimaryBtnText}>Masuk ke Akun KomikNesia</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.appVersionText}>KomikNesia Mobile v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Customer Service Modal */}
      <Modal
        visible={csModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.csModalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.csTitleRow}>
                <Ionicons name="headset" size={20} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Customer Service</Text>
              </View>
              <TouchableOpacity onPress={() => setCsModalOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              Ada pertanyaan, laporan kendala, atau ingin konfirmasi langganan VIP? Hubungi kami langsung:
            </Text>

            {cleanPhone.length >= 8 && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setCsModalOpen(false);
                  Linking.openURL(`https://wa.me/${cleanPhone}?text=Halo%20Admin%20KomikNesia,%20saya%20butuh%20bantuan`).catch(() => {});
                }}
                style={[styles.csOptionRow, { borderColor: '#22C55E' }]}
              >
                <View style={[styles.csIconBox, { backgroundColor: '#22C55E' }]}>
                  <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
                </View>
                <View style={styles.csTextCol}>
                  <Text style={styles.csOptionTitle}>WhatsApp Customer Care</Text>
                  <Text style={styles.csOptionDesc}>Respon cepat setiap hari 09:00 - 22:00 WIB</Text>
                </View>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setCsModalOpen(false);
                Linking.openURL('https://discord.gg/dgC22PSm9h').catch(() => {});
              }}
              style={[styles.csOptionRow, { borderColor: '#5865F2' }]}
            >
              <View style={[styles.csIconBox, { backgroundColor: '#5865F2' }]}>
                <Ionicons name="logo-discord" size={20} color="#FFF" />
              </View>
              <View style={styles.csTextCol}>
                <Text style={styles.csOptionTitle}>Discord Komunitas</Text>
                <Text style={styles.csOptionDesc}>Bergabung & diskusi dengan tim admin & ribuan pembaca</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setCsModalOpen(false);
                Linking.openURL(websiteUrl || 'https://komiknesia.id').catch(() => {});
              }}
              style={[styles.csOptionRow, { borderColor: '#F59E0B' }]}
            >
              <View style={[styles.csIconBox, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="globe-outline" size={20} color="#0B0F19" />
              </View>
              <View style={styles.csTextCol}>
                <Text style={styles.csOptionTitle}>Website Resmi</Text>
                <Text style={styles.csOptionDesc}>Kunjungi website untuk akses lengkap & langganan VIP</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Edit Profil</Text>
              <TouchableOpacity onPress={() => setEditModalOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Nama Lengkap</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nama kamu"
                placeholderTextColor={COLORS.textMuted}
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Bio Singkat</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tulis bio singkat..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                style={[styles.textInput, styles.textArea]}
              />

              <Text style={[styles.inputLabel, { marginTop: SPACING.md }]}>
                Kata Sandi Sekarang (opsional)
              </Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Kata sandi saat ini"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Kata Sandi Baru (opsional)</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Kata sandi baru"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Konfirmasi Kata Sandi Baru</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Ulangi kata sandi baru"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                style={styles.textInput}
              />

              <TouchableOpacity
                style={[styles.saveBtn, updating && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  topHeaderTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl * 2,
  },

  // 1. Photo Profil & User Info
  profileCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  crownBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#D97706',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  vipTag: {
    backgroundColor: '#D97706',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
  },
  vipTagText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  userHandle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  userEmail: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  userBio: {
    color: '#D1D5DB',
    fontSize: 12,
    marginTop: SPACING.sm,
    lineHeight: 17,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: SPACING.xs,
  },

  // Guest Card
  guestCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guestAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestTextCol: {
    flex: 1,
  },
  guestTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  guestDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  guestLoginBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
  },
  guestLoginBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // 2. KomikNesia Premium Card
  premiumBannerCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  premiumLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  premiumCrownBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(253, 230, 138, 0.4)',
  },
  premiumTextCol: {
    flex: 1,
  },
  premiumBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  premiumTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  vipPillMini: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  vipPillMiniText: {
    color: '#000',
    fontSize: 8.5,
    fontWeight: '900',
  },
  premiumSubtitle: {
    color: '#FDE68A',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  premiumArrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // 3. Info Card
  menuSection: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  menuSectionTitle: {
    color: '#9CA3AF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    color: '#D1D5DB',
    fontSize: 12.5,
    fontWeight: '600',
  },
  infoVal: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusBadgeVip: {
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  statusBadgeVipText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeNormal: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusBadgeNormalText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
  },

  // 4. Menu Items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemTextCol: {
    flex: 1,
  },
  menuItemText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  menuItemSubtext: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },

  // 5. Auth / Logout Section
  authSection: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  loginPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  loginPrimaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  appVersionText: {
    color: '#4B5563',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  csModalCard: {
    backgroundColor: '#111827',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  csTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },
  modalDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.md,
  },
  csOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  csIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  csTextCol: {
    flex: 1,
  },
  csOptionTitle: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  csOptionDesc: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 1,
  },

  // Edit Profile Modal
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputLabel: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});

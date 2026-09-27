import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

const { width } = Dimensions.get('window');

const PREMIUM_PACKAGES = [
  {
    id: '1m',
    duration: '1 Bulan',
    priceStr: 'Rp 20.000',
    priceNumber: 20000,
    perMonth: 'Rp 20.000 / bln',
    tag: null,
    highlight: false,
  },
  {
    id: '3m',
    duration: '3 Bulan',
    priceStr: 'Rp 55.000',
    priceNumber: 55000,
    perMonth: 'Rp 18.300 / bln',
    tag: 'HEMAT RP 5.000',
    highlight: false,
  },
  {
    id: '6m',
    duration: '6 Bulan',
    priceStr: 'Rp 105.000',
    priceNumber: 105000,
    perMonth: 'Rp 17.500 / bln',
    tag: '🔥 PALING POPULER',
    highlight: true,
  },
  {
    id: '12m',
    duration: '12 Bulan (1 Tahun)',
    priceStr: 'Rp 205.000',
    priceNumber: 205000,
    perMonth: 'Rp 17.000 / bln',
    tag: '👑 HEMAT MAKSIMAL',
    highlight: false,
  },
];

const BENEFITS = [
  {
    icon: 'ban-outline',
    color: '#EF4444',
    title: 'No Iklan Banner & Google AdMob',
    desc: 'Bebas sepenuhnya dari segala jenis iklan banner, popup, dan intervensi iklan.',
  },
  {
    icon: 'cloud-download-outline',
    color: '#3B82F6',
    title: 'Download Tanpa Iklan',
    desc: 'Unduh chapter komik ke memori HP tanpa menunggu atau menonton iklan reward.',
  },
  {
    icon: 'book-outline',
    color: '#10B981',
    title: 'Baca Tanpa Iklan',
    desc: 'Akses seluruh chapter langsung terbuka tanpa jeda iklan kelipatan 5x.',
  },
  {
    icon: 'speedometer-outline',
    color: '#F59E0B',
    title: 'Fitur Auto-Scroll',
    desc: 'Membaca santai maraton tanpa perlu menyentuh layar secara manual.',
  },
  {
    icon: 'sparkles',
    color: '#8B5CF6',
    title: 'Akses Chapter VIP Lebih Awal',
    desc: 'Nikmati chapter rilis terbaru langsung tanpa menunggu jeda waktu 2 jam.',
  },
];

export const PremiumScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('6m');

  const selectedPackage = PREMIUM_PACKAGES.find((p) => p.id === selectedPlan) || PREMIUM_PACKAGES[2];

  const handleSubscribeWhatsApp = () => {
    const username = user?.username || user?.name || (isAuthenticated ? 'Pengguna' : 'Tamu');
    const message = encodeURIComponent(
      `Halo Admin KomikNesia, saya ingin berlangganan Paket Premium ${selectedPackage.duration} (${selectedPackage.priceStr}) untuk akun saya:\nUsername: ${username}\nEmail: ${user?.email || '-'}`
    );
    const waUrl = `https://wa.me/6281234567890?text=${message}`;

    Linking.openURL(waUrl).catch(() => {
      // Fallback web url
      Linking.openURL('https://komiknesia.id');
    });
  };

  const handleOpenWebPayment = async () => {
    const webUrl = 'https://komiknesia.id';
    try {
      const supported = await Linking.canOpenURL(webUrl);
      if (supported) {
        await Linking.openURL(webUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (err) {
      Alert.alert(
        'Kunjungi Website KomikNesia',
        'Silakan buka browser Anda dan akses https://komiknesia.id untuk melakukan pembayaran paket premium.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>KomikNesia Premium</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Gold Header */}
        <LinearGradient
          colors={['#D97706', '#92400E', '#451A03', '#0B0F19']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroHeader}
        >
          <View style={styles.crownCircle}>
            <Ionicons name="diamond" size={40} color="#FDE68A" />
          </View>
          <Text style={styles.heroTitle}>Upgrade ke VIP Premium</Text>
          <Text style={styles.heroSubtitle}>
            Nikmati pengalaman membaca komik tanpa batas dengan berbagai keuntungan eksklusif.
          </Text>

          {user?.membership_active && (
            <View style={styles.activeVipPill}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.activeVipText}>Kamu Saat Ini Adalah Member VIP</Text>
            </View>
          )}
        </LinearGradient>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionHeaderTitle}>Keuntungan Menjadi Member VIP</Text>
          <View style={styles.benefitList}>
            {BENEFITS.map((item, idx) => (
              <View key={`b-${idx}`} style={styles.benefitRow}>
                <View style={[styles.benefitIconBox, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>{item.title}</Text>
                  <Text style={styles.benefitDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing Packages Section */}
        <View style={styles.pricingSection}>
          <Text style={styles.sectionHeaderTitle}>Pilih Paket Langganan</Text>
          <Text style={styles.sectionHeaderSubtitle}>
            Harga terjangkau dengan akses instan ke seluruh fitur VIP.
          </Text>

          <View style={styles.packageList}>
            {PREMIUM_PACKAGES.map((pkg) => {
              const isSelected = selectedPlan === pkg.id;
              return (
                <TouchableOpacity
                  key={pkg.id}
                  activeOpacity={0.85}
                  onPress={() => setSelectedPlan(pkg.id)}
                  style={[
                    styles.packageCard,
                    isSelected && styles.packageCardSelected,
                    pkg.highlight && !isSelected && styles.packageCardPopular,
                  ]}
                >
                  {pkg.tag && (
                    <View
                      style={[
                        styles.packageTag,
                        pkg.highlight ? styles.packageTagPopular : styles.packageTagNormal,
                      ]}
                    >
                      <Text style={styles.packageTagText}>{pkg.tag}</Text>
                    </View>
                  )}

                  <View style={styles.packageContentRow}>
                    <View style={styles.packageRadioCircle}>
                      {isSelected ? (
                        <View style={styles.packageRadioInner} />
                      ) : null}
                    </View>

                    <View style={styles.packageTitleCol}>
                      <Text style={[styles.packageDuration, isSelected && { color: '#FFF' }]}>
                        {pkg.duration}
                      </Text>
                      <Text style={styles.packagePerMonth}>{pkg.perMonth}</Text>
                    </View>

                    <View style={styles.packagePriceCol}>
                      <Text style={[styles.packagePrice, isSelected && { color: '#F59E0B' }]}>
                        {pkg.priceStr}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Metode Pembayaran / Action Section */}
        <View style={styles.actionSection}>
          <Text style={styles.paymentSectionHeader}>PILIH CARA PEMBAYARAN</Text>

          {/* Opsi 1: Bayar via Website komiknesia.id */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleOpenWebPayment}
            style={styles.webPayBtn}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.webPayGradient}
            >
              <View style={styles.webPayIconBox}>
                <Ionicons name="globe-outline" size={20} color="#0B0F19" />
              </View>
              <View style={styles.webPayTextCol}>
                <Text style={styles.webPayTitle}>Bayar via Website (komiknesia.id)</Text>
                <Text style={styles.webPaySubtitle}>
                  Buka link https://komiknesia.id ({selectedPackage.priceStr})
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#0B0F19" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Opsi 2: Beli via WhatsApp Admin */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubscribeWhatsApp}
            style={styles.subscribeBtn}
          >
            <Ionicons name="logo-whatsapp" size={19} color="#22C55E" />
            <Text style={styles.subscribeBtnText}>
              Beli via WhatsApp Admin ({selectedPackage.duration})
            </Text>
          </TouchableOpacity>

          {/* Direct URL quick link */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleOpenWebPayment}
            style={styles.directLinkRow}
          >
            <Text style={styles.directLinkLabel}>Link Website Resmi: </Text>
            <Text style={styles.directLinkUrl}>komiknesia.id</Text>
            <Ionicons name="arrow-forward" size={12} color="#F59E0B" />
          </TouchableOpacity>

          <Text style={styles.guaranteeText}>
            🔒 Pembayaran aman melalui website resmi komiknesia.id atau konfirmasi langsung dengan Admin Customer Service.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#0B0F19',
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  navTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl * 2,
  },
  heroHeader: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    alignItems: 'center',
  },
  crownCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: 'rgba(253, 230, 138, 0.4)',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    color: '#D1D5DB',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    paddingHorizontal: SPACING.md,
  },
  activeVipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginTop: SPACING.md,
  },
  activeVipText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },

  // Benefits
  benefitsSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  sectionHeaderTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: SPACING.md,
  },
  benefitList: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
    marginTop: SPACING.xs,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  benefitDesc: {
    color: '#9CA3AF',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },

  // Pricing Packages
  pricingSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  packageList: {
    gap: 10,
    marginTop: SPACING.xs,
  },
  packageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  packageCardSelected: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderColor: '#D97706',
  },
  packageCardPopular: {
    borderColor: 'rgba(217, 119, 6, 0.35)',
  },
  packageTag: {
    position: 'absolute',
    top: -9,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  packageTagPopular: {
    backgroundColor: '#DC2626',
  },
  packageTagNormal: {
    backgroundColor: '#1E3A8A',
  },
  packageTagText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  packageContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  packageRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  packageRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D97706',
  },
  packageTitleCol: {
    flex: 1,
  },
  packageDuration: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '800',
  },
  packagePerMonth: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 1,
  },
  packagePriceCol: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  // Actions
  actionSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    alignItems: 'center',
    gap: 10,
  },
  paymentSectionHeader: {
    color: '#9CA3AF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    alignSelf: 'flex-start',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  webPayBtn: {
    width: '100%',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  webPayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
    gap: 12,
  },
  webPayIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webPayTextCol: {
    flex: 1,
  },
  webPayTitle: {
    color: '#0B0F19',
    fontSize: 14.5,
    fontWeight: '900',
  },
  webPaySubtitle: {
    color: 'rgba(11, 15, 25, 0.75)',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 1,
  },
  subscribeBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 13,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  subscribeBtnText: {
    color: '#E5E7EB',
    fontSize: 13.5,
    fontWeight: '700',
  },
  directLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  directLinkLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  directLinkUrl: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  guaranteeText: {
    color: '#6B7280',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
});

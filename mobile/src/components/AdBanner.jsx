import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Text,
  Animated,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '../api/client';
import { RADIUS, SPACING } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const SingleAdCardComponent = ({ ad, width }) => {
  const [loaded, setLoaded] = useState(false);
  const imageUrl = getImageUrl(ad?.image);
  // Default aspect ratio fallback (will be overridden immediately by true image dimensions)
  const [aspectRatio, setAspectRatio] = useState(null);
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!loaded) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 750,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [loaded, pulseAnim]);

  useEffect(() => {
    if (!imageUrl) return;
    let isMounted = true;
    RNImage.getSize(
      imageUrl,
      (origWidth, origHeight) => {
        if (isMounted && origWidth && origHeight && origHeight > 0) {
          setAspectRatio(origWidth / origHeight);
        }
      },
      (err) => {
        console.warn('Failed to get ad image size:', err);
      }
    );
    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  const handlePress = () => {
    if (ad?.link_url) {
      Linking.openURL(ad.link_url).catch((err) => {
        console.warn('Failed to open ad URL:', err);
      });
    }
  };

  if (!imageUrl) return null;

  // Rasio aspek fallback untuk placeholder/skeleton:
  const cardRatio = aspectRatio && aspectRatio > 0 ? aspectRatio : 7.8;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      style={[
        styles.adWrapper,
        {
          width: width || '100%',
        },
        !loaded ? { height: 46 } : { aspectRatio: cardRatio },
      ]}
    >
      {!loaded && (
        <Animated.View style={[styles.skeletonPlaceholder, { opacity: pulseAnim }]}>
          <Ionicons name="megaphone-outline" size={14} color="#6B7280" />
        </Animated.View>
      )}

      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.adImage,
          !loaded && styles.adImageHidden,
        ]}
        contentFit="fill" // Mengisi 100% full width & height tanpa ada sisa hitam di kiri/kanan
        cachePolicy="memory-disk"
        onLoad={(e) => {
          setLoaded(true);
          const { width: imgW, height: imgH } = e?.source || {};
          if (imgW && imgH && imgH > 0) {
            setAspectRatio(imgW / imgH);
          }
        }}
      />
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>AD</Text>
      </View>
    </TouchableOpacity>
  );
};

const SingleAdCard = React.memo(SingleAdCardComponent);

const LoadingSkeleton = ({ containerPadding, gap, style }) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.container, { paddingHorizontal: containerPadding, gap }, style]}>
      <View style={[styles.adWrapper, { width: '100%', height: 46 }]}>
        <Animated.View style={[styles.skeletonPlaceholder, { opacity: pulseAnim }]}>
          <Ionicons name="megaphone-outline" size={14} color="#6B7280" />
        </Animated.View>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>AD</Text>
        </View>
      </View>
    </View>
  );
};

const AdBannerComponent = ({
  ads = [],
  columns = 1, // ALWAYS 1 GRID - Never 2 Grid
  style,
  containerPadding = SPACING.lg,
  gap = SPACING.sm,
  loading = false,
}) => {
  const { user, isAuthenticated } = useAuth();
  const membershipType = String(user?.membership_type || '').toLowerCase().trim();
  const isMobileMembership = membershipType === 'mobile' || membershipType === 'both';
  const hasVipOrActive = Boolean(user?.membership_active || user?.role === 'vip' || user?.role === 'premium');
  const isVip = isAuthenticated && (hasVipOrActive && isMobileMembership);

  if (isVip) return null; // Premium Mobile = No Iklan Banner

  // Pastikan hanya iklan yang platformnya 'mobile' atau 'both'/'keduanya'/'all'
  const allowedAds = (ads || []).filter((ad) => {
    if (!ad) return false;
    const platform = String(ad.target_platform || '').toLowerCase().trim();
    return (
      platform === 'mobile' ||
      platform === 'both' ||
      platform === 'keduanya' ||
      platform === 'all'
    );
  });

  if (loading && allowedAds.length === 0) {
    return <LoadingSkeleton containerPadding={containerPadding} gap={gap} style={style} />;
  }

  if (allowedAds.length === 0) {
    return null;
  }

  // Tampilkan SEMUA iklan tanpa limit, full width 1 grid per banner
  return (
    <View style={[styles.container, { paddingHorizontal: containerPadding, gap }, style]}>
      {allowedAds.map((ad, idx) => (
        <SingleAdCard
          key={ad.id || `ad-${idx}`}
          ad={ad}
          width="100%"
        />
      ))}
    </View>
  );
};

export const AdBanner = React.memo(AdBannerComponent);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'column', // Single column 1 grid
    alignItems: 'center',
    marginVertical: SPACING.xs,
  },
  adWrapper: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#121622',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  skeletonPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#151C2C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  adImageHidden: {
    opacity: 0,
  },
  adBadge: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 5,
  },
  adBadgeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default AdBanner;

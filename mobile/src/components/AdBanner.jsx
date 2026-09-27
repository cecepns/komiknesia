import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Dimensions,
  Text,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '../api/client';
import { RADIUS, SPACING } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SingleAdCardComponent = ({ ad, width, isTwoCol = true }) => {
  const defaultRatio = isTwoCol ? 3.8 : 6.0;
  const maxCardHeight = isTwoCol ? 54 : 68;
  const minCardHeight = isTwoCol ? 38 : 44;

  const [loaded, setLoaded] = useState(false);
  const imageUrl = getImageUrl(ad?.image);

  const handlePress = () => {
    if (ad?.link_url) {
      Linking.openURL(ad.link_url).catch((err) => {
        console.warn('Failed to open ad URL:', err);
      });
    }
  };

  if (!imageUrl) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      style={[
        styles.adWrapper,
        {
          width,
          aspectRatio: defaultRatio,
          maxHeight: maxCardHeight,
          minHeight: minCardHeight,
        },
      ]}
    >
      {!loaded && (
        <View style={styles.skeletonPlaceholder}>
          <Ionicons name="megaphone-outline" size={14} color="#6B7280" />
        </View>
      )}

      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.adImage,
          !loaded && styles.adImageHidden,
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
        onLoad={() => setLoaded(true)}
      />
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>AD</Text>
      </View>
    </TouchableOpacity>
  );
};

const SingleAdCard = React.memo(SingleAdCardComponent);

import { useAuth } from '../contexts/AuthContext';

const AdBannerComponent = ({
  ads = [],
  columns = 2,
  style,
  containerPadding = SPACING.lg,
  gap = SPACING.sm,
  loading = false,
}) => {
  const { user, isAuthenticated } = useAuth();
  const isVip = isAuthenticated && (!!user?.membership_active || user?.role === 'vip') && (!user?.membership_type || user?.membership_type === 'mobile' || user?.membership_type === 'both');
  if (isVip) return null; // Premium Mobile = No Iklan Banner

  const isTwoCol = columns >= 2 && (ads.length >= 2 || (loading && columns === 2));
  const availableWidth = SCREEN_WIDTH - containerPadding * 2;
  const itemWidth = isTwoCol ? Math.floor((availableWidth - gap) / 2) : availableWidth;
  const maxCardHeight = isTwoCol ? 54 : 68;
  const minCardHeight = isTwoCol ? 38 : 44;

  if (loading && (!ads || ads.length === 0)) {
    const count = isTwoCol ? 2 : 1;
    return (
      <View style={[styles.container, { paddingHorizontal: containerPadding, gap }, style]}>
        {Array.from({ length: count }).map((_, i) => (
          <View
            key={`ad-skel-${i}`}
            style={[
              styles.adWrapper,
              styles.skeletonPlaceholder,
              {
                width: itemWidth,
                height: maxCardHeight,
                maxHeight: maxCardHeight,
                minHeight: minCardHeight,
              },
            ]}
          >
            <Ionicons name="megaphone-outline" size={14} color="#4B5563" />
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>AD</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (!ads || ads.length === 0) {
    return null;
  }

  const colCount = Math.min(columns, ads.length >= 2 ? 2 : 1);
  const actualItemWidth = colCount === 2 ? Math.floor((availableWidth - gap) / 2) : availableWidth;

  return (
    <View style={[styles.container, { paddingHorizontal: containerPadding, gap }, style]}>
      {ads.map((ad, idx) => (
        <SingleAdCard
          key={ad.id || `ad-${idx}`}
          ad={ad}
          width={actualItemWidth}
          isTwoCol={colCount === 2}
        />
      ))}
    </View>
  );
};

export const AdBanner = React.memo(AdBannerComponent);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: SPACING.xs,
  },
  adWrapper: {
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#151C2C',
    justifyContent: 'center',
    alignItems: 'center',
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
    bottom: 2,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 5,
  },
  adBadgeText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default AdBanner;

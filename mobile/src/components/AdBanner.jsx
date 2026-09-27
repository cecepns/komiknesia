import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Dimensions,
  Text,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '../api/client';
import { RADIUS, SPACING } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SingleAdCard = ({ ad, width, isTwoCol = true }) => {
  // Mobile banner ads: compact horizontal aspect ratio to avoid excessively tall skeletons
  const defaultRatio = isTwoCol ? 3.8 : 6.0;
  const maxCardHeight = isTwoCol ? 54 : 68;
  const minCardHeight = isTwoCol ? 38 : 44;

  const [aspectRatio, setAspectRatio] = useState(defaultRatio);
  const [loaded, setLoaded] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0.35)).current;
  const imageUrl = getImageUrl(ad?.image);

  useEffect(() => {
    if (!loaded) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.65,
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
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [loaded, pulseAnim]);

  useEffect(() => {
    if (!imageUrl) return;
    let isMounted = true;
    Image.getSize(
      imageUrl,
      (w, h) => {
        if (isMounted && w > 0 && h > 0) {
          // Clamp ratio so height is strictly compact and horizontal (never tall portrait)
          const minR = isTwoCol ? 3.2 : 4.5;
          const maxR = isTwoCol ? 7.0 : 8.5;
          const ratio = Math.min(Math.max(w / h, minR), maxR);
          setAspectRatio(ratio);
        }
      },
      () => {
        // Fallback keep defaultRatio
      }
    );
    return () => {
      isMounted = false;
    };
  }, [imageUrl, isTwoCol]);

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
          aspectRatio,
          maxHeight: maxCardHeight,
          minHeight: minCardHeight,
        },
      ]}
    >
      {/* Skeleton loading pulse placeholder if image hasn't loaded yet */}
      {!loaded && (
        <Animated.View
          style={[
            styles.skeletonPlaceholder,
            { opacity: pulseAnim },
          ]}
        >
          <Ionicons name="megaphone-outline" size={14} color="#6B7280" />
        </Animated.View>
      )}

      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.adImage,
          !loaded && styles.adImageHidden,
        ]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>AD</Text>
      </View>
    </TouchableOpacity>
  );
};

import { useAuth } from '../contexts/AuthContext';

export const AdBanner = ({
  ads = [],
  columns = 2,
  style,
  containerPadding = SPACING.lg,
  gap = SPACING.sm,
  loading = false,
}) => {
  const { user, isAuthenticated } = useAuth();
  const isVip = isAuthenticated && (!!user?.membership_active || user?.role === 'vip');
  if (isVip) return null; // Premium = No Iklan Banner & Google

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

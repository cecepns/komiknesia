import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { getImageUrl } from '../api/client';
import { timeAgo } from '../utils/timeAgo';
import { requiresChapterLogin } from '../utils/chapterAccess';

const { width } = Dimensions.get('window');

// 2 columns: (width - 32 - 12) / 2
const CARD_WIDTH_2COL = Math.floor((width - SPACING.lg * 2 - SPACING.md) / 2);
// 3 columns: (width - 32 - 24) / 3
const CARD_WIDTH_3COL = Math.floor((width - SPACING.lg * 2 - SPACING.md * 2) / 3);

const MangaCardComponent = ({
  manga,
  onPress,
  onChapterPress,
  width: customWidth,
  columns = 2,
  horizontal = false,
  showLastChapters = false,
  showLatestChapter = true,
  isAuthenticated = false,
  rank = null,
  showRating = false,
}) => {
  if (!manga) return null;

  const itemWidth =
    customWidth || (horizontal ? 135 : columns === 2 ? CARD_WIDTH_2COL : CARD_WIDTH_3COL);
  const coverHeight = horizontal ? 180 : itemWidth * 1.33; // 3:4 portrait ratio

  const imageUrl = getImageUrl(manga.cover || manga.image || manga.thumbnail);
  const title = manga.title || 'Tanpa Judul';
  const rating = Number(manga.rating || manga.score || 0).toFixed(1);

  const lastChapters =
    Array.isArray(manga.lastChapters) && manga.lastChapters.length > 0
      ? manga.lastChapters.slice(0, 3)
      : Array.isArray(manga.chapters) && manga.chapters.length > 0
      ? manga.chapters.slice(0, 3)
      : manga.latest_chapter
      ? [manga.latest_chapter]
      : manga.chapter
      ? [{ number: manga.chapter, slug: manga.slug }]
      : [];

  return (
    <View
      style={[
        styles.card,
        { width: itemWidth },
        showLastChapters && styles.cardWithChapters,
      ]}
    >
      {/* Cover Touchable */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => onPress && onPress(manga)}
        style={[
          styles.coverContainer,
          { height: coverHeight },
          showLastChapters && styles.coverWithChapters,
        ]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.coverImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={imageUrl}
          />
        ) : (
          <View style={styles.placeholderCover}>
            <Ionicons name="book-outline" size={28} color={COLORS.textMuted} />
          </View>
        )}

        {/* Rank Badge */}
        {rank !== null && rank !== undefined && (
          <View
            style={[
              styles.rankBadge,
              rank === 1
                ? styles.rankGold
                : rank === 2
                ? styles.rankSilver
                : rank === 3
                ? styles.rankBronze
                : styles.rankDefault,
            ]}
          >
            <Text
              style={[
                styles.rankBadgeText,
                rank <= 2 ? { color: '#000' } : { color: '#FFF' },
              ]}
            >
              #{rank}
            </Text>
          </View>
        )}

        {/* Rating Badge */}
        {showRating && Number(rating) > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color={COLORS.star} />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        )}

        {/* Hot Badge */}
        {manga.hot ? (
          <View style={styles.hotBadge}>
            <Text style={styles.hotBadgeText}>HOT</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={showLastChapters ? styles.infoContainerWithChapters : null}>
        {/* Title */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onPress && onPress(manga)}
        >
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
        </TouchableOpacity>

        {/* 3 Last Chapters (matching web ChapterAccessLink) */}
        {showLastChapters ? (
          <View style={styles.lastChaptersContainer}>
            {lastChapters.length > 0 ? (
              lastChapters.map((ch, idx) => {
                const isLocked = requiresChapterLogin(ch, isAuthenticated);
                const chNumber = ch.number || ch.chapter_number || '?';
                const chTime = timeAgo(
                  ch.scheduled_release_at?.time ||
                  ch.created_at?.time ||
                  ch.created_at ||
                  ch.uploadedAt
                );

                return (
                  <TouchableOpacity
                    key={`ch-${ch.slug || ch.id || idx}`}
                    activeOpacity={0.75}
                    onPress={() => onChapterPress && onChapterPress(ch, manga)}
                    style={[
                      styles.chapterLinkRow,
                      isLocked && styles.chapterLinkRowLocked,
                    ]}
                  >
                    <View style={styles.chapterLinkLeft}>
                      <View
                        style={[
                          styles.chapterDot,
                          isLocked ? styles.chapterDotLocked : styles.chapterDotUnlocked,
                        ]}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.chapterLinkText,
                          isLocked && styles.chapterLinkTextLocked,
                        ]}
                      >
                        Chapter {chNumber}
                      </Text>
                      {isLocked ? (
                        <Ionicons name="lock-closed" size={10} color="#F59E0B" />
                      ) : null}
                    </View>

                    {chTime ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.chapterLinkTime,
                          isLocked && styles.chapterLinkTimeLocked,
                        ]}
                      >
                        {chTime}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.chapterLinkRow}>
                <Text style={styles.chapterEmptyText}>Chapter N/A</Text>
              </View>
            )}
          </View>
        ) : showLatestChapter && (manga.latest_chapter || manga.chapter) ? (
          // Single latest chapter fallback
          <View style={styles.singleChapterRow}>
            <Text numberOfLines={1} style={styles.singleChapterText}>
              Ch. {manga.latest_chapter?.number || manga.chapter || '?'}
            </Text>
            {manga.latest_chapter?.created_at ? (
              <Text numberOfLines={1} style={styles.singleChapterTime}>
                {' • '}{timeAgo(manga.latest_chapter.created_at)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
  },
  cardWithChapters: {
    backgroundColor: '#121622',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  coverContainer: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#0F121C',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  coverWithChapters: {
    borderRadius: 0,
    borderWidth: 0,
  },
  infoContainerWithChapters: {
    padding: 8,
    paddingTop: 8,
    paddingBottom: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
    zIndex: 2,
  },
  typeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    zIndex: 2,
  },
  ratingText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  projectBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
    zIndex: 2,
  },
  projectBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },
  hotBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
    zIndex: 2,
  },
  hotBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },
  title: {
    marginTop: 6,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    minHeight: 32,
  },
  lastChaptersContainer: {
    marginTop: 6,
    gap: 4,
  },
  chapterLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121218',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  chapterLinkRowLocked: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  chapterLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 4,
  },
  chapterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chapterDotUnlocked: {
    backgroundColor: COLORS.primary,
  },
  chapterDotLocked: {
    backgroundColor: '#F59E0B',
  },
  chapterLinkText: {
    color: '#F3F4F6',
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 1,
  },
  chapterLinkTextLocked: {
    color: '#FDE68A',
  },
  chapterLinkTime: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '500',
    flexShrink: 0,
  },
  chapterLinkTimeLocked: {
    color: 'rgba(253, 230, 138, 0.75)',
  },
  chapterEmptyText: {
    color: '#6B7280',
    fontSize: 10,
    fontStyle: 'italic',
  },
  singleChapterRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  singleChapterText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  singleChapterTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm - 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
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
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
});

export const MangaCard = React.memo(MangaCardComponent);

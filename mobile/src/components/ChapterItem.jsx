import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { timeAgo } from '../utils/timeAgo';

export const ChapterItem = ({
  chapter,
  isLocked = false,
  isRead = false,
  isActive = false,
  isLatest = false,
  thumbnailUrl = null,
  views = null,
  reactionCount = null,
  onPress,
  onDownloadPdf,
  onDownloadOffline,
  isDownloaded = false,
  isDownloading = false,
}) => {
  if (!chapter) return null;

  const chapterNum = chapter.number || chapter.chapter_number || '?';
  const chapterTitle =
    chapter.title && chapter.title !== `Chapter ${chapterNum}`
      ? chapter.title
      : `Chapter ${chapterNum}`;
  const timeStr = timeAgo(
    chapter.scheduled_release_at?.time ||
      chapter.created_at?.time ||
      chapter.created_at ||
      chapter.uploadedAt
  );

  const formattedViews =
    views !== null && views !== undefined
      ? Number(views).toLocaleString('id-ID')
      : null;
  const formattedReactions =
    reactionCount !== null && reactionCount !== undefined
      ? Number(reactionCount).toLocaleString('id-ID')
      : null;

  // Rich Web-like Chapter Item (with thumbnail and stats)
  if (thumbnailUrl) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onPress && onPress(chapter)}
        style={[
          styles.richContainer,
          isLocked && styles.lockedRichContainer,
          isRead && styles.readRichContainer,
          isActive && styles.activeRichContainer,
        ]}
      >
        <View style={styles.richLeft}>
          {/* 3:4 Chapter Thumbnail */}
          <View style={styles.thumbnailWrapper}>
            <Image
              source={{ uri: thumbnailUrl }}
              style={[styles.thumbnailImg, isRead && { opacity: 0.5 }]}
              resizeMode="cover"
            />
          </View>

          {/* Chapter Meta */}
          <View style={styles.richMeta}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.richTitle,
                  isRead ? styles.readTitle : styles.unreadTitle,
                  isActive && styles.activeTitle,
                ]}
              >
                {chapterTitle}
              </Text>
              {isLocked ? (
                <Ionicons name="lock-closed" size={13} color="#F59E0B" />
              ) : null}
            </View>

            {timeStr ? <Text style={styles.richTime}>{timeStr}</Text> : null}

            {/* Stats: views & reactions */}
            <View style={styles.richStatsRow}>
              {formattedViews ? (
                <View style={styles.richStat}>
                  <Ionicons name="eye-outline" size={11} color={COLORS.textMuted} />
                  <Text style={styles.richStatText}>{formattedViews} lihat</Text>
                </View>
              ) : null}
              {formattedReactions ? (
                <View style={styles.richStat}>
                  <Ionicons name="sparkles" size={11} color="#F59E0B" />
                  <Text style={[styles.richStatText, { color: '#F59E0B' }]}>
                    {formattedReactions} reaksi
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Right Badges & Actions */}
        <View style={styles.richRight}>
          {isLatest && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}

          {onDownloadOffline ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onDownloadOffline && onDownloadOffline(chapter)}
              style={[
                styles.offlineDownloadBtn,
                isDownloaded && styles.offlineDownloadBtnDownloaded,
              ]}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : isDownloaded ? (
                <>
                  <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                  <Text style={styles.offlineDownloadedText}>Offline</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={13} color="#38BDF8" />
                  <Text style={styles.offlineDownloadText}>Unduh</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <Ionicons
            name="chevron-forward"
            size={16}
            color={isActive ? COLORS.primary : COLORS.textMuted}
          />
        </View>
      </TouchableOpacity>
    );
  }

  // Standard Compact Chapter Item (used in Reader drawer)
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress && onPress(chapter)}
      style={[
        styles.container,
        isActive && styles.activeContainer,
        isRead && !isActive && styles.readContainer,
      ]}
    >
      <View style={styles.leftSection}>
        <View style={[styles.iconCircle, isActive && styles.activeIconCircle]}>
          {isLocked ? (
            <Ionicons name="lock-closed" size={14} color={COLORS.vip} />
          ) : isActive ? (
            <Ionicons name="play" size={14} color="#FFF" />
          ) : isRead ? (
            <Ionicons name="checkmark-done" size={14} color={COLORS.textMuted} />
          ) : (
            <Ionicons name="document-text-outline" size={14} color={COLORS.textSecondary} />
          )}
        </View>

        <View style={styles.textWrapper}>
          <Text
            style={[
              styles.chapterNumber,
              isActive && styles.activeText,
              isRead && !isActive && styles.readText,
            ]}
          >
            Chapter {chapterNum}
          </Text>
          {chapterTitle && chapterTitle !== `Chapter ${chapterNum}` ? (
            <Text numberOfLines={1} style={styles.chapterTitle}>
              {chapterTitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.rightSection}>
        {timeStr ? <Text style={styles.timeText}>{timeStr}</Text> : null}
        {isLocked ? (
          <View style={styles.lockBadge}>
            <Text style={styles.lockBadgeText}>Kunci (Tamu)</Text>
          </View>
        ) : (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={isActive ? COLORS.primary : COLORS.textMuted}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Compact styles
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  activeContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: COLORS.primary,
  },
  readContainer: {
    opacity: 0.7,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  activeIconCircle: {
    backgroundColor: COLORS.primary,
  },
  textWrapper: {
    flex: 1,
  },
  chapterNumber: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  activeText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  readText: {
    color: COLORS.textSecondary,
  },
  chapterTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  lockBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  lockBadgeText: {
    color: COLORS.vip,
    fontSize: 10,
    fontWeight: '600',
  },

  // Rich Web-like styles
  richContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm + 2,
    backgroundColor: '#0A0A0E',
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  lockedRichContainer: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  readRichContainer: {
    opacity: 0.82,
  },
  activeRichContainer: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  richLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm + 2,
    marginRight: SPACING.sm,
  },
  thumbnailWrapper: {
    width: 48,
    height: 64,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#121218',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  richMeta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  richTitle: {
    fontSize: 13,
  },
  unreadTitle: {
    color: '#FFF',
    fontWeight: '800',
  },
  readTitle: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  activeTitle: {
    color: COLORS.primary,
    fontWeight: '900',
  },
  richTime: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 3,
  },
  richStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    flexWrap: 'wrap',
  },
  richStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  richStatText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  richRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  newBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  pdfDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
  },
  pdfDownloadText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
  },
  offlineDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  offlineDownloadBtnDownloaded: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  offlineDownloadText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  offlineDownloadedText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
});

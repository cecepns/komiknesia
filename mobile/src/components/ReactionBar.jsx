import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { REACTION_OPTIONS } from '../constants/reactions';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export const ReactionBar = ({
  reactions = {},
  selectedReaction = null,
  onSelectReaction,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Bagaimana tanggapanmu?</Text>
      <View style={styles.reactionsRow}>
        {REACTION_OPTIONS.map((item) => {
          const isSelected = selectedReaction === item.id;
          const count = reactions[item.id] || 0;

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              disabled={disabled}
              onPress={() => onSelectReaction && onSelectReaction(item.id)}
              style={[
                styles.reactionItem,
                isSelected && styles.selectedReactionItem,
              ]}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text
                style={[
                  styles.label,
                  isSelected && styles.selectedLabel,
                ]}
              >
                {item.label}
              </Text>
              <View style={[styles.badge, isSelected && styles.selectedBadge]}>
                <Text
                  style={[
                    styles.badgeCount,
                    isSelected && styles.selectedBadgeCount,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginVertical: SPACING.md,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reactionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: 2,
    borderRadius: RADIUS.md,
    marginHorizontal: 2,
  },
  selectedReactionItem: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  emoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedLabel: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  badge: {
    marginTop: 4,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  selectedBadge: {
    backgroundColor: COLORS.primary,
  },
  badgeCount: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  selectedBadgeCount: {
    color: '#FFF',
  },
});

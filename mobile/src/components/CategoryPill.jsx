import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export const CategoryPill = ({
  label,
  active = false,
  onPress,
  badge = null,
  size = 'medium',
  style,
}) => {
  const isSmall = size === 'small';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.pill,
        isSmall && styles.pillSmall,
        active ? styles.pillActive : styles.pillInactive,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          isSmall && styles.textSmall,
          active ? styles.textActive : styles.textInactive,
        ]}
      >
        {label}
      </Text>
      {badge !== null && (
        <Text
          style={[
            styles.badge,
            active ? styles.badgeActive : styles.badgeInactive,
          ]}
        >
          {badge}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  pillSmall: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillInactive: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
  textActive: {
    color: '#FFF',
  },
  textInactive: {
    color: COLORS.textSecondary,
  },
  badge: {
    marginLeft: 5,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeActive: {
    color: '#FFF',
  },
  badgeInactive: {
    color: COLORS.textMuted,
  },
});

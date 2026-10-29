import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../theme';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  selectedId: T;
  onSelect: (id: T) => void;
  style?: ViewStyle;
}

export function SegmentedControl<T extends string = string>({
  options,
  selectedId,
  onSelect,
  style,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]}>
      {options.map((opt) => {
        const isSelected = selectedId === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.segment, isSelected && styles.segmentActive]}
            onPress={() => onSelect(opt.id)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={14}
                color={isSelected ? '#FFFFFF' : THEME.colors.textSecondary}
                style={styles.icon}
              />
            ) : null}
            <Text style={[styles.label, isSelected && styles.labelActive]}>
              {opt.label}
            </Text>
            {opt.count !== undefined ? (
              <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                <Text style={[styles.countText, isSelected && styles.countTextActive]}>
                  {opt.count}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: THEME.borderRadius.sm,
  },
  segmentActive: {
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  labelActive: {
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(13, 148, 136, 0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  countTextActive: {
    color: THEME.colors.mint,
  },
});

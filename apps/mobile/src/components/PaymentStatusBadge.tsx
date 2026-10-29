import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';

export interface PaymentStatusBadgeProps {
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = 'small',
  style,
}) => {
  let bg: string = THEME.colors.pendingBg;
  let text: string = THEME.colors.pending;
  let border: string = THEME.colors.pendingBorder;
  let iconName: keyof typeof Ionicons.glyphMap = 'time-outline';
  let label = 'Pending';

  if (status === 'CONFIRMED') {
    bg = THEME.colors.confirmedBg;
    text = THEME.colors.confirmed;
    border = THEME.colors.confirmedBorder;
    iconName = 'checkmark-circle-outline';
    label = 'Confirmed';
  } else if (status === 'DISPUTED') {
    bg = THEME.colors.disputedBg;
    text = THEME.colors.disputed;
    border = THEME.colors.disputedBorder;
    iconName = 'alert-circle-outline';
    label = 'Disputed';
  } else if (status === 'CANCELLED') {
    bg = THEME.colors.cancelledBg;
    text = THEME.colors.cancelled;
    border = THEME.colors.cancelledBorder;
    iconName = 'close-circle-outline';
    label = 'Cancelled';
  }

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border },
        isSmall ? styles.badgeSmall : styles.badgeMedium,
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Payment status: ${label}`}
    >
      <Ionicons
        name={iconName}
        size={isSmall ? 12 : 14}
        color={text}
        style={styles.icon}
      />
      <Text style={[styles.label, { color: text, fontSize: isSmall ? 11 : 12 }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeMedium: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

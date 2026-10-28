import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';

interface PaymentStatusBadgeProps {
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
  size?: 'small' | 'medium';
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = 'small',
}) => {
  let bg = THEME.colors.pendingBg;
  let text = THEME.colors.pending;
  let border = THEME.colors.pendingBorder || '#FDE68A';
  let iconName: keyof typeof Ionicons.glyphMap = 'time-outline';
  let label = 'Pending';

  if (status === 'CONFIRMED') {
    bg = THEME.colors.creditBg;
    text = THEME.colors.credit;
    border = THEME.colors.creditBorder || '#A7F3D0';
    iconName = 'checkmark-circle-outline';
    label = 'Confirmed';
  } else if (status === 'DISPUTED') {
    bg = THEME.colors.debtBg;
    text = THEME.colors.debt;
    border = THEME.colors.debtBorder || '#FECACA';
    iconName = 'alert-circle-outline';
    label = 'Disputed';
  } else if (status === 'CANCELLED') {
    bg = '#F1F5F9';
    text = THEME.colors.textMuted;
    border = '#E2E8F0';
    iconName = 'close-circle-outline';
    label = 'Cancelled';
  }

  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons name={iconName} size={isSmall ? 13 : 15} color={text} style={styles.icon} />
      <Text style={[styles.label, { color: text, fontSize: isSmall ? 11 : 12 }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

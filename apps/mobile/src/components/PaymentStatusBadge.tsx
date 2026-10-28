import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../theme';

interface PaymentStatusBadgeProps {
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({ status }) => {
  let bg = THEME.colors.pendingBg;
  let text = THEME.colors.pending;
  let label = 'Pending';

  if (status === 'CONFIRMED') {
    bg = THEME.colors.creditBg;
    text = THEME.colors.credit;
    label = 'Confirmed';
  } else if (status === 'DISPUTED') {
    bg = THEME.colors.debtBg;
    text = THEME.colors.debt;
    label = 'Disputed';
  } else if (status === 'CANCELLED') {
    bg = '#F1F5F9';
    text = THEME.colors.textMuted;
    label = 'Cancelled';
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

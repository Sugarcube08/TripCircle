import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseDetail } from '@tripcircle/contracts';
import { AmountText } from './AmountText';
import { formatDate } from '../utils/formatters';
import { THEME } from '../theme';

interface ExpenseRowProps {
  expense: ExpenseDetail;
  currentUserId?: string;
  onPress: () => void;
}

function getCategoryIcon(name: string): { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  const lower = (name || '').toLowerCase();
  if (lower.includes('food') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('breakfast') || lower.includes('meal')) {
    return { icon: 'restaurant-outline', color: '#F97316', bg: '#FFF7ED' };
  }
  if (lower.includes('stay') || lower.includes('hotel') || lower.includes('airbnb') || lower.includes('resort')) {
    return { icon: 'bed-outline', color: '#8B5CF6', bg: '#F5F3FF' };
  }
  if (lower.includes('travel') || lower.includes('cab') || lower.includes('taxi') || lower.includes('flight') || lower.includes('transport') || lower.includes('train')) {
    return { icon: 'car-outline', color: '#3B82F6', bg: '#EFF6FF' };
  }
  if (lower.includes('drink') || lower.includes('bar') || lower.includes('coffee') || lower.includes('cafe')) {
    return { icon: 'cafe-outline', color: '#EC4899', bg: '#FDF2F8' };
  }
  if (lower.includes('activity') || lower.includes('ticket') || lower.includes('tour') || lower.includes('museum')) {
    return { icon: 'ticket-outline', color: '#10B981', bg: '#ECFDF5' };
  }
  if (lower.includes('shop') || lower.includes('grocery') || lower.includes('market')) {
    return { icon: 'bag-handle-outline', color: '#F59E0B', bg: '#FFFBEB' };
  }
  return { icon: 'receipt-outline', color: '#0D9488', bg: '#F0FDFA' };
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({
  expense,
  currentUserId,
  onPress,
}) => {
  const isPayer = expense.payer?.userId === currentUserId;
  const myAllocation = expense.allocations.find((a) => a.member?.userId === currentUserId);
  const cat = getCategoryIcon(expense.category?.name || '');

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.iconCircle, { backgroundColor: cat.bg }]}>
        <Ionicons name={cat.icon} size={20} color={cat.color} />
      </View>

      <View style={styles.details}>
        <Text style={styles.description} numberOfLines={1}>
          {expense.description}
        </Text>
        <View style={styles.subtextRow}>
          <Text style={isPayer ? styles.payerYou : styles.payerOther}>
            {isPayer ? 'You paid' : `${(expense.payer?.user?.name || expense.payer?.displayName || 'Member').split(' ')[0]} paid`}
          </Text>
          <Text style={styles.subtext}> · {formatDate(expense.expenseDate)}</Text>
          {expense.receiptUrl ? (
            <Ionicons name="attach-outline" size={13} color={THEME.colors.textMuted} style={styles.attachIcon} />
          ) : null}
        </View>
      </View>

      <View style={styles.amounts}>
        <AmountText paise={expense.amountPaise} size="medium" colorType="neutral" />
        {myAllocation ? (
          <Text style={[styles.shareText, isPayer && styles.shareCredit]}>
            {isPayer ? `You lent ₹${((expense.amountPaise - myAllocation.sharePaise) / 100).toFixed(2)}` : `Your share: ₹${(myAllocation.sharePaise / 100).toFixed(2)}`}
          </Text>
        ) : (
          <Text style={styles.notInvolvedText}>Not involved</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: THEME.spacing.md,
    backgroundColor: THEME.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.md,
  },
  details: {
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  description: {
    ...THEME.typography.h3,
    fontSize: 15,
    marginBottom: 3,
  },
  subtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachIcon: {
    marginLeft: 4,
  },
  subtext: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  payerYou: {
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  payerOther: {
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  amounts: {
    alignItems: 'flex-end',
  },
  shareText: {
    fontSize: 12,
    color: THEME.colors.debt,
    fontWeight: '500',
    marginTop: 2,
  },
  shareCredit: {
    color: THEME.colors.credit,
  },
  notInvolvedText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpenseDetail } from '@tripcircle/contracts';
import { AmountText } from './AmountText';
import { formatDate } from '../utils/formatters';
import { THEME, getCategoryConfig } from '../theme';

interface ExpenseRowProps {
  expense: ExpenseDetail;
  currentUserId?: string;
  onPress: () => void;
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({
  expense,
  currentUserId,
  onPress,
}) => {
  const isPayer = expense.payer?.userId === currentUserId;
  const myAllocation = expense.allocations.find((a) => a.member?.userId === currentUserId);
  const cat = getCategoryConfig(expense.category?.name || expense.category?.key);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Expense: ${expense.description}, amount ${(expense.amountPaise / 100).toFixed(2)} rupees`}
    >
      <View style={[styles.iconCircle, { backgroundColor: cat.bg, borderColor: cat.border }]}>
        <Ionicons name={cat.icon} size={18} color={cat.color} />
      </View>

      <View style={styles.details}>
        <Text style={styles.description} numberOfLines={1}>
          {expense.description}
        </Text>
        <View style={styles.subtextRow}>
          <Text style={isPayer ? styles.payerYou : styles.payerOther}>
            {isPayer
              ? 'You paid'
              : `${(expense.payer?.user?.name || expense.payer?.displayName || 'Member').split(' ')[0]} paid`}
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
            {isPayer
              ? `You lent ₹${((expense.amountPaise - myAllocation.sharePaise) / 100).toFixed(2)}`
              : `Your share: ₹${(myAllocation.sharePaise / 100).toFixed(2)}`}
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
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.md,
    borderWidth: 1,
  },
  details: {
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 3,
  },
  subtextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payerYou: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.mint,
  },
  payerOther: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
  },
  subtext: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  attachIcon: {
    marginLeft: 4,
  },
  amounts: {
    alignItems: 'flex-end',
  },
  shareText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  shareCredit: {
    color: THEME.colors.mint,
    fontWeight: '600',
  },
  notInvolvedText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
});

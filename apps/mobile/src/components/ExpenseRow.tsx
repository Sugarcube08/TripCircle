import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ExpenseDetail } from '@tripcircle/contracts';
import { AmountText } from './AmountText';
import { formatDate } from '../utils/formatters';
import { THEME } from '../theme';

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

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>
          {expense.category?.name ? expense.category.name[0] : '₹'}
        </Text>
      </View>

      <View style={styles.details}>
        <Text style={styles.description} numberOfLines={1}>
          {expense.description}
        </Text>
        <Text style={styles.subtext}>
          {isPayer ? 'You paid' : `${expense.payer?.user.name || 'Member'} paid`} ·{' '}
          {formatDate(expense.expenseDate)}
        </Text>
      </View>

      <View style={styles.amounts}>
        <AmountText paise={expense.amountPaise} size="medium" colorType="neutral" />
        {myAllocation ? (
          <Text style={styles.shareText}>
            Share: {(myAllocation.sharePaise / 100).toFixed(2)}
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
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.md,
    backgroundColor: THEME.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.md,
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  details: {
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  description: {
    ...THEME.typography.h3,
    marginBottom: 2,
  },
  subtext: {
    ...THEME.typography.bodySmall,
  },
  amounts: {
    alignItems: 'flex-end',
  },
  shareText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  notInvolvedText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
});

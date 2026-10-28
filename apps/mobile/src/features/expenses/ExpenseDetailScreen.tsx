import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { apiRequest } from '../../services/api';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { THEME } from '../../theme';

interface ExpenseDetailScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const ExpenseDetailScreen: React.FC<ExpenseDetailScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId, expenseId } = route.params;
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadExpense = useCallback(async () => {
    try {
      const data = await apiRequest(`/trips/${tripId}/expenses/${expenseId}`);
      setExpense(data);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tripId, expenseId]);

  useEffect(() => {
    loadExpense();
    const unsubscribe = navigation.addListener('focus', loadExpense);
    return unsubscribe;
  }, [navigation, loadExpense]);

  if (loading) {
    return <LoadingIndicator message="Loading expense details..." />;
  }

  if (!expense) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40 }}>Expense not found.</Text>
      </View>
    );
  }

  const canEdit = expense.submitterId === user?.id;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.navBack}>← Back</Text>
        </TouchableOpacity>
        {canEdit ? (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditExpense', { tripId, expenseId })}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Main Card */}
        <View style={styles.mainCard}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{expense.category?.name || 'Expense'}</Text>
          </View>

          <Text style={styles.description}>{expense.description}</Text>
          <AmountText paise={expense.amountPaise} size="large" colorType="neutral" style={styles.amount} />
          <Text style={styles.dateText}>{formatDateTime(expense.expenseDate)}</Text>

          <View style={styles.divider} />

          {/* Paid by info */}
          <View style={styles.payerRow}>
            <Text style={styles.sectionLabel}>PAID BY</Text>
            <View style={styles.payerDetail}>
              <MemberAvatar
                name={expense.payerMember?.user.name || 'Member'}
                avatarUrl={expense.payerMember?.user.avatarUrl}
                size={34}
              />
              <Text style={styles.payerName}>{expense.payerMember?.user.name}</Text>
            </View>
          </View>

          {expense.location ? (
            <View style={styles.infoRow}>
              <Text style={styles.sectionLabel}>LOCATION</Text>
              <Text style={styles.infoValue}>{expense.location}</Text>
            </View>
          ) : null}

          {expense.note ? (
            <View style={styles.infoRow}>
              <Text style={styles.sectionLabel}>NOTE</Text>
              <Text style={styles.infoValue}>{expense.note}</Text>
            </View>
          ) : null}
        </View>

        {/* Beneficiaries Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>
            BENEFICIARY SHARES ({expense.allocations.length})
          </Text>

          {expense.allocations.map((alloc: any) => (
            <View key={alloc.id || alloc.memberId} style={styles.allocRow}>
              <View style={styles.allocMember}>
                <MemberAvatar
                  name={alloc.member?.user.name || 'Member'}
                  avatarUrl={alloc.member?.user.avatarUrl}
                  size={32}
                />
                <Text style={styles.allocName}>{alloc.member?.user.name}</Text>
              </View>
              <AmountText paise={alloc.sharePaise} size="medium" colorType="neutral" />
            </View>
          ))}
        </View>

        {/* Revision History */}
        {expense.revisions && expense.revisions.length > 1 ? (
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>REVISION HISTORY</Text>
            {expense.revisions.map((rev: any) => (
              <View key={rev.id} style={styles.revItem}>
                <View style={styles.revHeader}>
                  <Text style={styles.revVersion}>Version {rev.version}</Text>
                  <Text style={styles.revDate}>{formatDateTime(rev.createdAt)}</Text>
                </View>
                <Text style={styles.revText}>
                  Edited by {rev.editor?.name || 'Member'}: ₹{(rev.amountPaise / 100).toFixed(2)}
                  {rev.changeReason ? ` (${rev.changeReason})` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  navBack: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  editBtn: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.sm,
  },
  editText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  scroll: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  categoryBadge: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
    marginBottom: 10,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  description: {
    ...THEME.typography.h2,
    textAlign: 'center',
    marginBottom: 4,
  },
  amount: {
    marginVertical: 4,
  },
  dateText: {
    ...THEME.typography.bodySmall,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.divider,
    width: '100%',
    marginVertical: THEME.spacing.md,
  },
  payerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  payerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payerName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  infoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoValue: {
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  allocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  allocMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  allocName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  revItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  revHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  revVersion: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  revDate: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  revText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
});

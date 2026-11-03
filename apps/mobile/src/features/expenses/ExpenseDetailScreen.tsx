import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { LocalDatabase } from '../../storage/db';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { formatDateTime } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/media';
import { dialog } from '../../components/ui';
import { THEME, getCategoryConfig } from '../../theme';

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
  const initialCached = useMemo(() => {
    return LocalDatabase.getExpenses(tripId).find((e) => e.id === expenseId) || null;
  }, [tripId, expenseId]);

  const [expense, setExpense] = useState<any>(initialCached);
  const [loading, setLoading] = useState(!initialCached);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  const loadExpense = useCallback(async () => {
    try {
      const data = await apiRequest(`/trips/${tripId}/expenses/${expenseId}`);
      setExpense(data);
    } catch (err) {
      if (!initialCached) {
        dialog.alert('Error', (err as Error).message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, expenseId, initialCached]);

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
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Expense not found.</Text>
          <TouchableOpacity style={styles.backBtnSimple} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canEdit = expense.submitterId === user?.id;
  const catConfig = getCategoryConfig(expense.category?.name || expense.category?.key);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Details</Text>
        {canEdit ? (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditExpense', { tripId, expenseId })}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={THEME.colors.primaryDark} style={{ marginRight: 4 }} />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Hero Card */}
        <View style={styles.heroCard}>
          <View style={[styles.categoryBadge, { backgroundColor: catConfig.bg }]}>
            <Ionicons name={catConfig.icon} size={14} color={catConfig.color} style={{ marginRight: 5 }} />
            <Text style={[styles.categoryBadgeText, { color: catConfig.color }]}>
              {expense.category?.name || 'Expense'}
            </Text>
          </View>

          <Text style={styles.description}>{expense.description}</Text>

          <AmountText
            paise={expense.amountPaise}
            size="large"
            colorType="neutral"
            style={styles.amountText}
          />

          <Text style={styles.dateText}>{formatDateTime(expense.expenseDate)}</Text>

          {expense.receiptUrl && (
            <TouchableOpacity
              style={styles.receiptButton}
              onPress={() => setReceiptModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="image-outline" size={16} color={THEME.colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.receiptButtonText}>View Attached Receipt</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Paid By Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PAID BY</Text>
          <View style={styles.payerRow}>
            <MemberAvatar
              name={expense.payerMember?.user.name || 'Member'}
              avatarUrl={expense.payerMember?.user.avatarUrl}
              size={44}
            />
            <View style={styles.payerInfo}>
              <Text style={styles.payerName}>
                {expense.payerMember?.user.name} {expense.payerMember?.userId === user?.id ? '(You)' : ''}
              </Text>
              <Text style={styles.payerSub}>Paid the full bill upfront</Text>
            </View>
          </View>

          {expense.location ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={THEME.colors.textMuted} style={styles.detailIcon} />
              <Text style={styles.detailText}>{expense.location}</Text>
            </View>
          ) : null}

          {expense.note ? (
            <View style={styles.detailRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={THEME.colors.textMuted} style={styles.detailIcon} />
              <Text style={styles.detailText}>{expense.note}</Text>
            </View>
          ) : null}
        </View>

        {/* Beneficiaries Breakdown */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>
              SPLIT BREAKDOWN ({expense.allocations.length})
            </Text>
            <View style={styles.splitMethodPill}>
              <Text style={styles.splitMethodText}>{expense.splitMethod || 'EQUAL'}</Text>
            </View>
          </View>

          {expense.allocations.map((alloc: any, idx: number) => {
            const isYou = alloc.member?.userId === user?.id;
            return (
              <View
                key={alloc.id || alloc.memberId || idx}
                style={[
                  styles.allocRow,
                  idx === expense.allocations.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.allocMember}>
                  <MemberAvatar
                    name={alloc.member?.user.name || 'Member'}
                    avatarUrl={alloc.member?.user.avatarUrl}
                    size={36}
                  />
                  <Text style={styles.allocName}>
                    {alloc.member?.user.name} {isYou ? '(You)' : ''}
                  </Text>
                </View>
                <AmountText
                  paise={alloc.sharePaise}
                  size="medium"
                  colorType="neutral"
                  style={styles.allocAmount}
                />
              </View>
            );
          })}
        </View>

        {/* Revision History */}
        {expense.revisions && expense.revisions.length > 1 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>AUDIT REVISION HISTORY</Text>
            {expense.revisions.map((rev: any) => (
              <View key={rev.id} style={styles.revItem}>
                <View style={styles.revHeader}>
                  <View style={styles.revBadge}>
                    <Text style={styles.revBadgeText}>v{rev.version}</Text>
                  </View>
                  <Text style={styles.revDate}>{formatDateTime(rev.createdAt)}</Text>
                </View>
                <Text style={styles.revText}>
                  Edited by {rev.editor?.name || 'Member'}: ₹{(rev.amountPaise / 100).toFixed(2)}
                  {rev.changeReason ? ` · "${rev.changeReason}"` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Receipt Modal */}
      {expense.receiptUrl && (
        <Modal
          visible={receiptModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReceiptModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Receipt Attachment</Text>
                <TouchableOpacity onPress={() => setReceiptModalVisible(false)}>
                  <Ionicons name="close-circle" size={26} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              </View>
              {resolveMediaUrl(expense.receiptUrl) ? (
                <Image
                  source={{ uri: resolveMediaUrl(expense.receiptUrl)! }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...THEME.typography.h2,
    fontSize: 18,
    color: THEME.colors.textPrimary,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
  },
  editText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.mint,
  },
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  heroCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
    marginBottom: THEME.spacing.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    ...THEME.typography.h2,
    fontSize: 20,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  amountText: {
    fontSize: 34,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginVertical: 4,
  },
  dateText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginBottom: THEME.spacing.sm,
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.full,
    marginTop: 6,
  },
  receiptButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.mint,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: THEME.spacing.xs,
  },
  splitMethodPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  splitMethodText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  payerInfo: {
    marginLeft: 12,
  },
  payerName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  payerSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  detailIcon: {
    marginRight: 8,
  },
  detailText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  allocMember: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allocName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginLeft: 10,
  },
  allocAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  revItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  revHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  revBadge: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  revBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.mint,
  },
  revDate: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  revText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    marginBottom: 16,
  },
  backBtnSimple: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.md,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    width: '100%',
    maxHeight: '80%',
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    ...THEME.typography.h3,
    color: THEME.colors.textPrimary,
  },
  receiptImage: {
    width: '100%',
    height: 350,
    borderRadius: THEME.borderRadius.md,
  },
});

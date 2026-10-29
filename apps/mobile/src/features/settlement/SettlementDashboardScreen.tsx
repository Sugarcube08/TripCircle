import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { LocalDatabase } from '../../storage/db';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { ScreenHeader, SectionHeader, dialog } from '../../components/ui';
import { THEME } from '../../theme';

interface SettlementDashboardScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const SettlementDashboardScreen: React.FC<SettlementDashboardScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId } = route.params;
  const initialPlan = useMemo(() => LocalDatabase.getSettlementPlan(tripId), [tripId]);
  const [plan, setPlan] = useState<any>(initialPlan);
  const [loading, setLoading] = useState(!initialPlan);
  const [refreshing, setRefreshing] = useState(false);

  // Discount modal state
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [creditorMemberId, setCreditorMemberId] = useState('');
  const [originalDebtRupees, setOriginalDebtRupees] = useState('');
  const [paidRupees, setPaidRupees] = useState('');
  const [waivedRupees, setWaivedRupees] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [submittingDiscount, setSubmittingDiscount] = useState(false);

  const loadSettlement = useCallback(async () => {
    try {
      const data = await apiRequest(`/trips/${tripId}/settlement`);
      setPlan(data);
      LocalDatabase.saveSettlementPlan(tripId, data);
    } catch {
      const cached = LocalDatabase.getSettlementPlan(tripId);
      if (cached) setPlan(cached);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadSettlement();
  }, [loadSettlement]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSettlement();
  };

  const handleProposeDiscount = async () => {
    const origPaise = Math.round((parseFloat(originalDebtRupees) || 0) * 100);
    const paidPaise = Math.round((parseFloat(paidRupees) || 0) * 100);
    const waivedPaise = Math.round((parseFloat(waivedRupees) || 0) * 100);

    if (!creditorMemberId) {
      dialog.alert('Required', 'Please select the creditor member', 'warning');
      return;
    }
    if (origPaise <= 0 || waivedPaise <= 0) {
      dialog.alert('Invalid', 'Original debt and waived amount must be positive', 'warning');
      return;
    }
    if (paidPaise + waivedPaise !== origPaise) {
      dialog.alert('Mismatch', 'Paid amount + waived amount must equal original debt exactly', 'warning');
      return;
    }
    if (!discountReason.trim()) {
      dialog.alert('Required', 'Please enter a reason for the discount', 'warning');
      return;
    }

    try {
      setSubmittingDiscount(true);
      await apiRequest(`/trips/${tripId}/settlement/discounts`, {
        method: 'POST',
        body: JSON.stringify({
          toMemberId: creditorMemberId,
          originalDebtPaise: origPaise,
          paidAmountPaise: paidPaise,
          waivedPaise: waivedPaise,
          reason: discountReason.trim(),
        }),
      });

      await dialog.alert('Discount Recorded', 'Settlement discount recorded successfully.', 'success');
      setDiscountModalVisible(false);
      loadSettlement();
    } catch (err) {
      dialog.alert('Error', (err as Error).message, 'error');
    } finally {
      setSubmittingDiscount(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingIndicator message="Calculating settlement recommendations..." />;
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <ScreenHeader title="Settlement Plan" onBack={() => navigation.goBack()} />
        <View style={styles.emptyContainer}>
          <Ionicons name="calculator-outline" size={48} color={THEME.colors.textMuted} />
          <Text style={styles.errorText}>Could not calculate settlement recommendations.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const userBalance = plan.currentUserNetBalancePaise || 0;
  const isSettled = plan.isSettled;
  const transfersToReceive = plan.simplifiedTransfers.filter((t: any) => t.toUserId === user?.id);
  const transfersToPay = plan.simplifiedTransfers.filter((t: any) => t.fromUserId === user?.id);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />

      <ScreenHeader
        title="Settlement Plan"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            onPress={() => navigation.navigate('ExportReport', { tripId })}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Export Report"
          >
            <Ionicons name="document-text-outline" size={22} color={THEME.colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.colors.primary}
            colors={[THEME.colors.primary]}
          />
        }
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Net Outstanding Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceCardTitle}>YOUR OUTSTANDING BALANCE</Text>
          <View style={styles.balanceAmountRow}>
            <Text style={styles.balanceSub}>
              {userBalance > 0
                ? 'You are owed in this trip'
                : userBalance < 0
                ? 'You need to pay'
                : 'All settled up'}
            </Text>
            <AmountText
              paise={userBalance}
              size="large"
              colorType={userBalance > 0 ? 'credit' : userBalance < 0 ? 'debt' : 'neutral'}
            />
          </View>

          {isSettled ? (
            <View style={styles.settledBadge}>
              <Ionicons name="checkmark-circle" size={16} color={THEME.colors.credit} style={{ marginRight: 6 }} />
              <Text style={styles.settledText}>Entire trip is financially settled</Text>
            </View>
          ) : null}
        </View>

        {/* Notices for Pending or Disputed Payments */}
        {plan.pendingPaymentsCount > 0 ? (
          <View style={styles.warningBox}>
            <Ionicons name="time-outline" size={18} color={THEME.colors.pending} style={{ marginRight: 8 }} />
            <Text style={styles.warningText}>
              {plan.pendingPaymentsCount} payment{plan.pendingPaymentsCount > 1 ? 's are' : ' is'} pending receiver confirmation.
            </Text>
          </View>
        ) : null}

        {plan.disputedPaymentsCount > 0 ? (
          <View style={[styles.warningBox, styles.disputeBox]}>
            <Ionicons name="alert-circle-outline" size={18} color={THEME.colors.debt} style={{ marginRight: 8 }} />
            <Text style={[styles.warningText, { color: THEME.colors.debt }]}>
              {plan.disputedPaymentsCount} payment dispute{plan.disputedPaymentsCount > 1 ? 's' : ''} require attention.
            </Text>
          </View>
        ) : null}

        {/* Transfers To Receive */}
        <View style={styles.section}>
          <SectionHeader
            title="YOU RECEIVE"
            count={transfersToReceive.length}
          />

          {transfersToReceive.length > 0 ? (
            transfersToReceive.map((t: any, idx: number) => (
              <View key={idx} style={styles.transferCard}>
                <MemberAvatar name={t.fromUserName} size={40} />
                <View style={styles.transferInfo}>
                  <Text style={styles.transferParty}>{t.fromUserName}</Text>
                  <Text style={styles.transferHint}>should pay you</Text>
                </View>
                <AmountText paise={t.amountPaise} size="medium" colorType="credit" />
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.noTransfers}>No incoming payments recommended.</Text>
            </View>
          )}
        </View>

        {/* Transfers To Pay */}
        <View style={styles.section}>
          <SectionHeader
            title="YOU NEED TO PAY"
            count={transfersToPay.length}
          />

          {transfersToPay.length > 0 ? (
            transfersToPay.map((t: any, idx: number) => (
              <View key={idx} style={styles.transferCard}>
                <MemberAvatar name={t.toUserName} size={40} />
                <View style={styles.transferInfo}>
                  <Text style={styles.transferParty}>Pay {t.toUserName}</Text>
                  <Text style={styles.transferHint}>Simplified direct transfer</Text>
                </View>
                <View style={styles.transferActionCol}>
                  <AmountText paise={t.amountPaise} size="medium" colorType="debt" />
                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() =>
                      navigation.navigate('AddPayment', {
                        tripId,
                        defaultReceiverMemberId: t.toMemberId,
                      })
                    }
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Pay ${t.toUserName}`}
                  >
                    <Text style={styles.payBtnText}>Pay Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.noTransfers}>No outstanding payments to make.</Text>
            </View>
          )}
        </View>

        {/* All Group Transfers Summary */}
        <View style={styles.section}>
          <SectionHeader
            title="ALL GROUP TRANSFERS"
            count={plan.simplifiedTransfers.length}
          />
          <View style={styles.allTransfersCard}>
            {plan.simplifiedTransfers.map((t: any, idx: number) => (
              <View key={idx} style={[styles.allTransferRow, idx > 0 && styles.rowBorderTop]}>
                <View style={styles.allTransferNames}>
                  <Text style={styles.nameFrom}>{t.fromUserName}</Text>
                  <Ionicons name="arrow-forward" size={14} color={THEME.colors.textMuted} style={{ marginHorizontal: 8 }} />
                  <Text style={styles.nameTo}>{t.toUserName}</Text>
                </View>
                <AmountText paise={t.amountPaise} size="small" colorType="neutral" />
              </View>
            ))}
            {plan.simplifiedTransfers.length === 0 ? (
              <Text style={styles.noTransfers}>No group transfers needed. Everyone is settled!</Text>
            ) : null}
          </View>
        </View>

        {/* Secondary Actions */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.discountBtn}
            onPress={() => setDiscountModalVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Settlement Discount"
          >
            <Ionicons name="pricetag-outline" size={18} color={THEME.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.discountBtnText}>Settlement Discount</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => navigation.navigate('ExportReport', { tripId })}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Export Report"
          >
            <Ionicons name="download-outline" size={18} color="#0B0F19" style={{ marginRight: 6 }} />
            <Text style={styles.exportBtnText}>Export Report</Text>
          </TouchableOpacity>
        </View>

        {/* Settlement Discount Modal */}
        <Modal
          visible={discountModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setDiscountModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Propose Settlement Discount</Text>
                <TouchableOpacity
                  onPress={() => setDiscountModalVisible(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSub}>
                Explicitly record an agreed waiver or rounding adjustment (e.g. waiving fractional coins).
              </Text>

              <Text style={styles.inputLabel}>Creditor Member</Text>
              <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                {plan.memberBalances
                  .filter((b: any) => b.userId !== user?.id && b.netBalancePaise > 0)
                  .map((m: any) => (
                    <TouchableOpacity
                      key={m.memberId}
                      style={[
                        styles.creditorChoice,
                        creditorMemberId === m.memberId && styles.selectedCreditor,
                      ]}
                      onPress={() => setCreditorMemberId(m.memberId)}
                    >
                      <Text style={styles.creditorName}>{m.userName}</Text>
                      <AmountText paise={m.netBalancePaise} size="small" colorType="credit" />
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Original Debt (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 1586.65"
                placeholderTextColor={THEME.colors.textMuted}
                value={originalDebtRupees}
                onChangeText={setOriginalDebtRupees}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Actual Paid Amount (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 1586.00"
                placeholderTextColor={THEME.colors.textMuted}
                value={paidRupees}
                onChangeText={setPaidRupees}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Waived Discount (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 0.65"
                placeholderTextColor={THEME.colors.textMuted}
                value={waivedRupees}
                onChangeText={setWaivedRupees}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Reason / Audit Note</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Rounded off fractional coins"
                placeholderTextColor={THEME.colors.textMuted}
                value={discountReason}
                onChangeText={setDiscountReason}
              />

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setDiscountModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmit}
                  onPress={handleProposeDiscount}
                  disabled={submittingDiscount}
                >
                  <Text style={styles.modalSubmitText}>
                    {submittingDiscount ? 'Saving...' : 'Propose'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scroll: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: THEME.spacing.xl,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 16,
    ...THEME.typography.bodySmall,
    color: THEME.colors.textMuted,
  },
  balanceCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.md,
  },
  balanceCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  balanceAmountRow: {
    marginVertical: THEME.spacing.sm,
  },
  balanceSub: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.creditBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: THEME.spacing.xs,
  },
  settledText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.credit,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.pendingBg,
    borderWidth: 1,
    borderColor: THEME.colors.pendingBorder,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  disputeBox: {
    backgroundColor: THEME.colors.debtBg,
    borderColor: THEME.colors.debtBorder,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.pending,
    flex: 1,
  },
  section: {
    marginBottom: THEME.spacing.lg,
  },
  transferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.sm,
    ...THEME.shadows.sm,
  },
  transferInfo: {
    flex: 1,
    marginLeft: THEME.spacing.sm,
  },
  transferParty: {
    ...THEME.typography.h3,
    fontSize: 15,
  },
  transferHint: {
    ...THEME.typography.bodySmall,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  transferActionCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  payBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.md,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payBtnText: {
    color: '#0B0F19',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  noTransfers: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  allTransfersCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    paddingHorizontal: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  allTransferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  allTransferNames: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nameFrom: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  nameTo: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.lg,
  },
  discountBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.sm,
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B0F19',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: THEME.spacing.lg,
  },
  modalCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.xl,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    ...THEME.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    ...THEME.typography.h2,
    fontSize: 18,
  },
  modalSub: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginTop: 10,
    marginBottom: 6,
  },
  creditorChoice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surface,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  selectedCreditor: {
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  creditorName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  modalInput: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: THEME.spacing.lg,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  modalSubmit: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: THEME.borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B0F19',
  },
});

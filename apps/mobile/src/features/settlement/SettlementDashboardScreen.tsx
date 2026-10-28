import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { LocalDatabase } from '../../storage/db';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
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
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
      Alert.alert('Required', 'Please select the creditor member');
      return;
    }
    if (origPaise <= 0 || waivedPaise <= 0) {
      Alert.alert('Invalid', 'Original debt and waived amount must be positive');
      return;
    }
    if (paidPaise + waivedPaise !== origPaise) {
      Alert.alert('Mismatch', 'Paid amount + waived amount must equal original debt exactly');
      return;
    }
    if (!discountReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for the discount');
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

      Alert.alert('Discount Recorded', 'Settlement discount recorded successfully.');
      setDiscountModalVisible(false);
      loadSettlement();
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
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
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Settlement Plan</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.errorText}>Could not calculate settlement recommendations.</Text>
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

      {/* Top Header */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Settlement Plan</Text>
        <TouchableOpacity
          style={styles.exportNavBtn}
          onPress={() => navigation.navigate('ExportReport', { tripId })}
        >
          <Ionicons name="document-text-outline" size={22} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />
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
            <Text style={[styles.warningText, { color: '#F87171' }]}>
              {plan.disputedPaymentsCount} payment dispute{plan.disputedPaymentsCount > 1 ? 's' : ''} require attention.
            </Text>
          </View>
        ) : null}

        {/* Transfers To Receive */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>YOU RECEIVE</Text>
            <View style={[styles.badgePill, { backgroundColor: THEME.colors.creditBg }]}>
              <Text style={[styles.badgeText, { color: THEME.colors.credit }]}>
                {transfersToReceive.length}
              </Text>
            </View>
          </View>

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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>YOU NEED TO PAY</Text>
            <View style={[styles.badgePill, { backgroundColor: THEME.colors.debtBg }]}>
              <Text style={[styles.badgeText, { color: THEME.colors.debt }]}>
                {transfersToPay.length}
              </Text>
            </View>
          </View>

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
          <Text style={styles.sectionTitle}>ALL GROUP TRANSFERS ({plan.simplifiedTransfers.length})</Text>
          <View style={styles.allTransfersCard}>
            {plan.simplifiedTransfers.map((t: any, idx: number) => (
              <View key={idx} style={[styles.allTransferRow, idx > 0 && styles.rowBorderTop]}>
                <View style={styles.allTransferNames}>
                  <Text style={styles.nameFrom}>{t.fromUserName}</Text>
                  <Ionicons name="arrow-forward" size={14} color={THEME.colors.textMuted} style={{ marginHorizontal: 6 }} />
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
          >
            <Ionicons name="pricetag-outline" size={18} color={THEME.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.discountBtnText}>Settlement Discount</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => navigation.navigate('ExportReport', { tripId })}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.exportBtnText}>Export Report</Text>
          </TouchableOpacity>
        </View>

        {/* Settlement Discount Modal */}
        <Modal
          visible={discountModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setDiscountModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Propose Settlement Discount</Text>
              <Text style={styles.modalSub}>
                Explicitly record an agreed waiver or rounding adjustment (e.g. waiving fractional coins).
              </Text>

              <Text style={styles.inputLabel}>Creditor Member</Text>
              <ScrollView style={{ maxHeight: 120 }}>
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
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    ...THEME.typography.h3,
    fontSize: 17,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 40,
    ...THEME.typography.bodySmall,
  },
  balanceCard: {
    backgroundColor: THEME.colors.darkCanvas,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#94A3B8',
    marginBottom: 4,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: THEME.spacing.xs,
  },
  settledText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  disputeBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FCD34D',
    flex: 1,
  },
  section: {
    marginBottom: THEME.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: THEME.spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: THEME.spacing.xs,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: THEME.borderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  transferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
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
    gap: 6,
  },
  payBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.sm,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  noTransfers: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  allTransfersCard: {
    backgroundColor: THEME.colors.card,
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
    paddingVertical: 12,
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
    backgroundColor: THEME.colors.card,
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
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: THEME.spacing.lg,
  },
  modalCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.xl,
    ...THEME.shadows.lg,
  },
  modalTitle: {
    ...THEME.typography.h2,
    marginBottom: 4,
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
    marginTop: 8,
    marginBottom: 4,
  },
  creditorChoice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.cardAlt,
    marginBottom: 4,
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
    backgroundColor: THEME.colors.inputBg,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.inputBorder,
    paddingHorizontal: 12,
    height: 42,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.sm,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  modalSubmit: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: THEME.borderRadius.sm,
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
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

      setDiscountModalVisible(false);
      Alert.alert('Discount Proposed', 'Discount waiver proposed. The creditor must accept it.');
      loadSettlement();
    } catch (err) {
      Alert.alert('Proposal Failed', (err as Error).message);
    } finally {
      setSubmittingDiscount(false);
    }
  };

  if (loading && !refreshing) {
    return <LoadingIndicator message="Calculating settlement recommendations..." />;
  }

  if (!plan) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40 }}>Could not calculate settlement.</Text>
      </View>
    );
  }

  const userBalance = plan.currentUserNetBalancePaise || 0;
  const isSettled = plan.isSettled;

  // Filter transfers involving current user
  const transfersToReceive = plan.simplifiedTransfers.filter((t: any) => t.toUserId === user?.id);
  const transfersToPay = plan.simplifiedTransfers.filter((t: any) => t.fromUserId === user?.id);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />
        }
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.headerTitle}>Settlement Plan</Text>

        {/* User's Net Outstanding Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceCardTitle}>YOUR OUTSTANDING BALANCE</Text>
          {userBalance > 0 ? (
            <>
              <Text style={styles.balanceSub}>You are owed</Text>
              <AmountText paise={userBalance} size="large" colorType="credit" />
            </>
          ) : userBalance < 0 ? (
            <>
              <Text style={styles.balanceSub}>You need to pay</Text>
              <AmountText paise={userBalance} size="large" colorType="debt" />
            </>
          ) : (
            <>
              <Text style={styles.balanceSub}>All settled</Text>
              <AmountText paise={0} size="large" colorType="neutral" />
            </>
          )}

          {isSettled ? (
            <View style={styles.settledBadge}>
              <Text style={styles.settledText}>✓ Entire Trip is Financially Settled</Text>
            </View>
          ) : null}
        </View>

        {/* Pending / Disputed Notices */}
        {plan.pendingPaymentsCount > 0 ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⏳ {plan.pendingPaymentsCount} payment{plan.pendingPaymentsCount > 1 ? 's are' : ' is'} pending receiver confirmation.
            </Text>
          </View>
        ) : null}

        {plan.disputedPaymentsCount > 0 ? (
          <View style={[styles.warningBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
            <Text style={[styles.warningText, { color: '#991B1B' }]}>
              ⚠️ {plan.disputedPaymentsCount} payment dispute{plan.disputedPaymentsCount > 1 ? 's' : ''} require resolution.
            </Text>
          </View>
        ) : null}

        {/* Transfers To Receive */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECEIVE</Text>
          {transfersToReceive.length > 0 ? (
            transfersToReceive.map((t: any, idx: number) => (
              <View key={idx} style={styles.transferCard}>
                <MemberAvatar name={t.fromUserName} size={36} />
                <View style={styles.transferInfo}>
                  <Text style={styles.transferParty}>{t.fromUserName} should pay you</Text>
                </View>
                <AmountText paise={t.amountPaise} size="medium" colorType="credit" />
              </View>
            ))
          ) : (
            <Text style={styles.noTransfers}>No incoming payments recommended.</Text>
          )}
        </View>

        {/* Transfers To Pay */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOU NEED TO PAY</Text>
          {transfersToPay.length > 0 ? (
            transfersToPay.map((t: any, idx: number) => (
              <View key={idx} style={styles.transferCard}>
                <MemberAvatar name={t.toUserName} size={36} />
                <View style={styles.transferInfo}>
                  <Text style={styles.transferParty}>You should pay {t.toUserName}</Text>
                </View>
                <AmountText paise={t.amountPaise} size="medium" colorType="debt" />
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() =>
                    navigation.navigate('AddPayment', {
                      tripId,
                      defaultReceiverMemberId: t.toMemberId,
                    })
                  }
                >
                  <Text style={styles.payBtnText}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.noTransfers}>No outstanding payments to make.</Text>
          )}
        </View>

        {/* Consolidated Settlement Plan across all members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ALL GROUP TRANSFERS</Text>
          {plan.simplifiedTransfers.map((t: any, idx: number) => (
            <View key={idx} style={styles.allTransferRow}>
              <Text style={styles.allTransferText}>
                • {t.fromUserName} ➔ {t.toUserName}
              </Text>
              <AmountText paise={t.amountPaise} size="small" colorType="neutral" />
            </View>
          ))}
          {plan.simplifiedTransfers.length === 0 ? (
            <Text style={styles.noTransfers}>Group is fully settled!</Text>
          ) : null}
        </View>

        {/* Action Buttons: Propose Discount & Export Report */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={styles.discountBtn}
            onPress={() => setDiscountModalVisible(true)}
          >
            <Text style={styles.discountBtnText}>Propose Settlement Discount</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => navigation.navigate('ExportReport', { tripId })}
          >
            <Text style={styles.exportBtnText}>📄 Export PDF / Excel</Text>
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
                Record an agreed waiver (e.g. waiving fractional coins like ₹0.65 or rounding off).
              </Text>

              <Text style={styles.inputLabel}>Creditor Member</Text>
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

              <Text style={styles.inputLabel}>Original Debt (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 1586.65"
                value={originalDebtRupees}
                onChangeText={setOriginalDebtRupees}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Actual Paid Amount (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 1586.00"
                value={paidRupees}
                onChangeText={setPaidRupees}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Waived Discount (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 0.65"
                value={waivedRupees}
                onChangeText={setWaivedRupees}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Reason</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Rounded off fractional rupee coins"
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
                  <Text style={styles.modalSubmitText}>Propose</Text>
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
  headerTitle: {
    ...THEME.typography.h1,
    marginBottom: THEME.spacing.md,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  balanceCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  balanceSub: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  settledBadge: {
    marginTop: 12,
    backgroundColor: THEME.colors.creditBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  settledText: {
    color: THEME.colors.credit,
    fontWeight: '700',
    fontSize: 12,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    marginBottom: THEME.spacing.md,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  transferCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  transferInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transferParty: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  noTransfers: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  payBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  allTransferRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  allTransferText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  btnRow: {
    gap: 12,
    marginTop: 8,
  },
  discountBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    paddingVertical: 13,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  discountBtnText: {
    color: THEME.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  exportBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 20,
  },
  modalTitle: {
    ...THEME.typography.h2,
    marginBottom: 4,
  },
  modalSub: {
    ...THEME.typography.bodySmall,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  creditorChoice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 6,
    marginBottom: 6,
  },
  selectedCreditor: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
  },
  creditorName: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  modalCancelText: {
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  modalSubmit: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: 6,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

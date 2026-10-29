import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { formatDateTime } from '../../utils/formatters';
import { dialog } from '../../components/ui';
import { THEME } from '../../theme';

interface PaymentDetailScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const PaymentDetailScreen: React.FC<PaymentDetailScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId, paymentId } = route.params;
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dispute modal state
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const loadPayment = useCallback(async () => {
    try {
      const data = await apiRequest(`/trips/${tripId}/payments/${paymentId}`);
      setPayment(data);
    } catch (err) {
      dialog.alert('Error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tripId, paymentId]);

  useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  if (loading) {
    return <LoadingIndicator message="Loading payment details..." />;
  }

  if (!payment) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Payment not found.</Text>
          <TouchableOpacity style={styles.backBtnSimple} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isReceiver = payment.receiverMember?.userId === user?.id;
  const isPayer = payment.payerMember?.userId === user?.id;
  const isPending = payment.status === 'PENDING';
  const payerName = payment.payerMember?.displayName || payment.payerMember?.user?.name || 'Payer';
  const receiverName = payment.receiverMember?.displayName || payment.receiverMember?.user?.name || 'Receiver';

  const handleConfirm = async () => {
    const confirmed = await dialog.confirm(
      'Confirm Payment Received',
      `Did you receive ₹${(payment.amountPaise / 100).toFixed(2)} from ${payerName}? This will immediately update your balance and settle this transfer.`,
      { confirmText: 'Confirm Received', type: 'success' }
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      const res = await apiRequest(
        `/trips/${tripId}/payments/${paymentId}/confirm`,
        { method: 'POST' }
      );
      setPayment(res);
      await dialog.alert('Payment Confirmed', 'The payment has been confirmed and ledger balances updated.', 'success');
    } catch (err) {
      dialog.alert('Confirmation Failed', (err as Error).message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      dialog.alert('Required', 'Please enter a reason for disputing this payment.', 'warning');
      return;
    }

    try {
      setActionLoading(true);
      const disputed = await apiRequest(`/trips/${tripId}/payments/${paymentId}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: disputeReason.trim() }),
      });
      setPayment(disputed);
      setDisputeModalVisible(false);
      await dialog.alert('Payment Disputed', 'Payment has been disputed. Group balances remain unaltered.', 'info');
    } catch (err) {
      dialog.alert('Dispute Failed', (err as Error).message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = await dialog.confirm(
      'Cancel Payment',
      'Are you sure you want to cancel this pending payment submission?',
      { confirmText: 'Yes, Cancel', destructive: true }
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      const cancelled = await apiRequest(`/trips/${tripId}/payments/${paymentId}`, {
        method: 'DELETE',
      });
      setPayment(cancelled);
      await dialog.alert('Payment Cancelled', 'The pending payment was cancelled.', 'info');
    } catch (err) {
      dialog.alert('Cancellation Failed', (err as Error).message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Status & Amount Card */}
        <View style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <PaymentStatusBadge status={payment.status} size="medium" />
            <View style={styles.methodBadge}>
              <Ionicons
                name={payment.paymentMethod === 'CASH' ? 'cash-outline' : payment.paymentMethod === 'UPI' ? 'phone-portrait-outline' : 'card-outline'}
                size={14}
                color={THEME.colors.primaryDark}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.methodBadgeText}>{payment.paymentMethod}</Text>
            </View>
          </View>

          <Text style={styles.amountLabel}>AMOUNT PAID</Text>
          <AmountText
            paise={payment.amountPaise}
            size="large"
            colorType="neutral"
            style={styles.amountText}
          />
          <Text style={styles.dateText}>{formatDateTime(payment.createdAt)}</Text>

          {/* Transfer Visual Representation */}
          <View style={styles.transferVisual}>
            <View style={styles.partyBox}>
              <Text style={styles.partyRole}>FROM (PAYER)</Text>
              <MemberAvatar
                name={payerName}
                avatarUrl={payment.payerMember?.user?.avatarUrl}
                size={44}
              />
              <Text style={styles.partyName} numberOfLines={1}>
                {payerName} {isPayer ? '(You)' : ''}
              </Text>
            </View>

            <View style={styles.arrowContainer}>
              <View style={styles.arrowLine} />
              <View style={styles.arrowIconCircle}>
                <Ionicons name="arrow-forward" size={16} color={THEME.colors.primary} />
              </View>
            </View>

            <View style={styles.partyBox}>
              <Text style={styles.partyRole}>TO (RECEIVER)</Text>
              <MemberAvatar
                name={receiverName}
                avatarUrl={payment.receiverMember?.user?.avatarUrl}
                size={44}
              />
              <Text style={styles.partyName} numberOfLines={1}>
                {receiverName} {isReceiver ? '(You)' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Metadata Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>PAYMENT INFORMATION</Text>

          {payment.note ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reference / Note</Text>
              <Text style={styles.infoValue}>{payment.note}</Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Recorded At</Text>
            <Text style={styles.infoValue}>{formatDateTime(payment.createdAt)}</Text>
          </View>

          {payment.confirmedAt ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Confirmed At</Text>
              <Text style={[styles.infoValue, { color: THEME.colors.credit }]}>
                {formatDateTime(payment.confirmedAt)}
              </Text>
            </View>
          ) : null}

          {payment.disputedAt ? (
            <View style={styles.disputeNotice}>
              <View style={styles.disputeNoticeHeader}>
                <Ionicons name="alert-circle" size={18} color={THEME.colors.debt} style={{ marginRight: 6 }} />
                <Text style={styles.disputeNoticeTitle}>Disputed by Receiver</Text>
              </View>
              <Text style={styles.disputeNoticeText}>"{payment.disputeReason}"</Text>
              <Text style={styles.disputeNoticeDate}>Disputed on {formatDateTime(payment.disputedAt)}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Controls for Receiver */}
        {isPending && isReceiver && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn]}
              onPress={handleConfirm}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmBtnText}>Confirm Payment Received</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.disputeBtn]}
              onPress={() => setDisputeModalVisible(true)}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={20} color={THEME.colors.debt} style={{ marginRight: 6 }} />
              <Text style={styles.disputeBtnText}>Dispute Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Controls for Payer */}
        {isPending && isPayer && (
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn]}
            onPress={handleCancel}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={18} color={THEME.colors.debt} style={{ marginRight: 6 }} />
            <Text style={styles.cancelBtnText}>Cancel Pending Payment</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Dispute Modal */}
      <Modal
        visible={disputeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDisputeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle-outline" size={24} color={THEME.colors.debt} style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Dispute Payment</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Explain why this transfer could not be verified (e.g. incorrect amount, funds not received in bank account).
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="State clear reason for dispute..."
              placeholderTextColor={THEME.colors.textLight}
              value={disputeReason}
              onChangeText={setDisputeReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setDisputeModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={handleDispute}
                disabled={actionLoading}
              >
                <Text style={styles.modalConfirmText}>Submit Dispute</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: THEME.spacing.sm,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  methodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
  amountText: {
    fontSize: 34,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginVertical: 4,
  },
  dateText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginBottom: THEME.spacing.md,
  },
  transferVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  partyBox: {
    alignItems: 'center',
    flex: 1,
  },
  partyRole: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  arrowLine: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: '#E2E8F0',
    width: 48,
  },
  arrowIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: THEME.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  infoLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  disputeNotice: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginTop: 10,
  },
  disputeNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  disputeNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.debt,
  },
  disputeNoticeText: {
    fontSize: 13,
    color: '#991B1B',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  disputeNoticeDate: {
    fontSize: 11,
    color: '#B91C1C',
  },
  actionsContainer: {
    gap: 10,
    marginTop: 6,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
  },
  confirmBtn: {
    backgroundColor: THEME.colors.credit,
    ...THEME.shadows.sm,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disputeBtn: {
    backgroundColor: THEME.colors.card,
    borderWidth: 1.5,
    borderColor: THEME.colors.debt,
  },
  disputeBtnText: {
    color: THEME.colors.debt,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
    marginTop: 10,
  },
  cancelBtnText: {
    color: THEME.colors.debt,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 20,
    ...THEME.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    ...THEME.typography.h2,
    fontSize: 18,
    color: THEME.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    fontSize: 14,
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
    color: THEME.colors.textPrimary,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  modalConfirmBtn: {
    backgroundColor: THEME.colors.debt,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
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
});

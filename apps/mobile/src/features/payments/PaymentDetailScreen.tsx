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
  SafeAreaView,
} from 'react-native';
import { apiRequest } from '../../services/api';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { formatDateTime } from '../../utils/formatters';
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
      Alert.alert('Error', (err as Error).message);
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
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40 }}>Payment not found.</Text>
      </View>
    );
  }

  const isReceiver = payment.receiverMember?.userId === user?.id;
  const isPayer = payment.payerMember?.userId === user?.id;
  const isPending = payment.status === 'PENDING';

  const handleConfirm = async () => {
    Alert.alert(
      'Confirm Payment',
      `Did you receive ₹${(payment.amountPaise / 100).toFixed(2)} from ${payment.payerMember?.user.name}? This will update balances immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Received',
          onPress: async () => {
            try {
              setActionLoading(true);
              const confirmed = await apiRequest(
                `/trips/${tripId}/payments/${paymentId}/confirm`,
                { method: 'POST' }
              );
              setPayment(confirmed);
              Alert.alert('Confirmed', 'Payment confirmed. Balances have been updated.');
            } catch (err) {
              Alert.alert('Confirmation Failed', (err as Error).message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      Alert.alert('Required', 'Please enter a dispute reason');
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
      Alert.alert('Payment Disputed', 'Payment has been disputed. Balances will not be affected.');
    } catch (err) {
      Alert.alert('Dispute Failed', (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Payment', 'Are you sure you want to cancel this pending payment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading(true);
            const cancelled = await apiRequest(`/trips/${tripId}/payments/${paymentId}`, {
              method: 'DELETE',
            });
            setPayment(cancelled);
            Alert.alert('Cancelled', 'Pending payment cancelled.');
          } catch (err) {
            Alert.alert('Cancellation Failed', (err as Error).message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <PaymentStatusBadge status={payment.status} />

          <Text style={styles.amountLabel}>PAYMENT AMOUNT</Text>
          <AmountText paise={payment.amountPaise} size="large" colorType="neutral" style={styles.amount} />
          <Text style={styles.methodText}>Method: {payment.paymentMethod}</Text>

          <View style={styles.divider} />

          {/* Transfer Parties */}
          <View style={styles.transferRow}>
            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>PAID BY</Text>
              <MemberAvatar
                name={payment.payerMember?.user.name || 'Payer'}
                avatarUrl={payment.payerMember?.user.avatarUrl}
                size={40}
              />
              <Text style={styles.partyName}>{payment.payerMember?.user.name}</Text>
            </View>

            <Text style={styles.arrowIcon}>➔</Text>

            <View style={styles.partyCol}>
              <Text style={styles.partyLabel}>PAID TO</Text>
              <MemberAvatar
                name={payment.receiverMember?.user.name || 'Receiver'}
                avatarUrl={payment.receiverMember?.user.avatarUrl}
                size={40}
              />
              <Text style={styles.partyName}>{payment.receiverMember?.user.name}</Text>
            </View>
          </View>

          {payment.note ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Note</Text>
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
              <Text style={styles.infoValue}>{formatDateTime(payment.confirmedAt)}</Text>
            </View>
          ) : null}

          {payment.disputedAt ? (
            <View style={styles.disputeBox}>
              <Text style={styles.disputeTitle}>Dispute Reason</Text>
              <Text style={styles.disputeText}>{payment.disputeReason}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Controls for Receiver or Payer */}
        {isPending && isReceiver ? (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn]}
              onPress={handleConfirm}
              disabled={actionLoading}
            >
              <Text style={styles.confirmBtnText}>✓ Confirm Payment Received</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.disputeBtn]}
              onPress={() => setDisputeModalVisible(true)}
              disabled={actionLoading}
            >
              <Text style={styles.disputeBtnText}>✕ Dispute Payment</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isPending && isPayer ? (
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn]}
            onPress={handleCancel}
            disabled={actionLoading}
          >
            <Text style={styles.cancelBtnText}>Cancel Pending Payment</Text>
          </TouchableOpacity>
        ) : null}

        {/* Dispute Modal */}
        <Modal
          visible={disputeModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setDisputeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Dispute Payment</Text>
              <Text style={styles.modalSubtitle}>
                State why this payment could not be confirmed (e.g. wrong amount, payment not received in account).
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Reason for dispute..."
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
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginTop: 12,
  },
  amount: {
    marginVertical: 4,
  },
  methodText: {
    ...THEME.typography.bodySmall,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.divider,
    width: '100%',
    marginVertical: THEME.spacing.md,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: THEME.spacing.md,
  },
  partyCol: {
    alignItems: 'center',
    flex: 1,
  },
  partyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
  arrowIcon: {
    fontSize: 22,
    color: THEME.colors.textMuted,
  },
  infoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
  disputeBox: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: THEME.borderRadius.md,
    width: '100%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  disputeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  disputeText: {
    fontSize: 13,
    color: '#991B1B',
  },
  actionsContainer: {
    gap: 12,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    backgroundColor: THEME.colors.credit,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disputeBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: THEME.colors.debt,
  },
  disputeBtnText: {
    color: THEME.colors.debt,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cancelBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 20,
  },
  modalTitle: {
    ...THEME.typography.h2,
    marginBottom: 6,
  },
  modalSubtitle: {
    ...THEME.typography.bodySmall,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
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
});

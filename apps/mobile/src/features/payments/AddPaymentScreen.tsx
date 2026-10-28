import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { PAYMENT_METHODS } from '@tripcircle/contracts';
import { apiRequest, getOnlineStatus } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { THEME } from '../../theme';

interface AddPaymentScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const AddPaymentScreen: React.FC<AddPaymentScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId, defaultReceiverMemberId } = route.params;
  const [amountRupees, setAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | 'OTHER'>('UPI');
  const [receiverMemberId, setReceiverMemberId] = useState<string>(defaultReceiverMemberId || '');
  const [payerMemberId, setPayerMemberId] = useState<string>('');
  const [note, setNote] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadMembers() {
      try {
        const tripData = await apiRequest(`/trips/${tripId}`);
        const activeMembers = tripData.members.filter((m: any) => m.status === 'ACTIVE');
        setMembers(activeMembers);

        const myMember = activeMembers.find((m: any) => m.userId === user?.id);
        if (myMember) {
          setPayerMemberId(myMember.id);
        }

        // If defaultReceiverMemberId not provided, default to first other member
        if (!defaultReceiverMemberId) {
          const otherMember = activeMembers.find((m: any) => m.userId !== user?.id);
          if (otherMember) {
            setReceiverMemberId(otherMember.id);
          }
        }
      } catch (err) {
        Alert.alert('Error', (err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadMembers();
  }, [tripId, user?.id, defaultReceiverMemberId]);

  const handleSubmit = async () => {
    if (!getOnlineStatus()) {
      Alert.alert('Offline', 'Recording payments requires an active network connection.');
      return;
    }

    const amountPaise = Math.round((parseFloat(amountRupees) || 0) * 100);
    if (amountPaise <= 0) {
      Alert.alert('Required', 'Please enter a valid payment amount');
      return;
    }
    if (!receiverMemberId) {
      Alert.alert('Required', 'Please select who received this payment');
      return;
    }
    if (receiverMemberId === payerMemberId) {
      Alert.alert('Invalid', 'Payer and receiver cannot be the same member');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest(`/trips/${tripId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          payerMemberId,
          receiverMemberId,
          amountPaise,
          paymentMethod,
          note: note.trim() || undefined,
          idempotencyKey: `pay-${Date.now()}-${payerMemberId}`,
        }),
      });

      Alert.alert(
        'Payment Submitted',
        'Your payment has been recorded as Pending. Balances will be updated once the receiver confirms.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Payment Submission Failed', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading payment form..." />;
  }

  const otherMembers = members.filter((m) => m.id !== payerMemberId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Record a Payment</Text>

      {/* Amount Card */}
      <View style={styles.card}>
        <Text style={styles.label}>PAYMENT AMOUNT</Text>
        <View style={styles.amountInputRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor="#94A3B8"
            value={amountRupees}
            onChangeText={setAmountRupees}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>
      </View>

      {/* Paid To Selector */}
      <View style={styles.card}>
        <Text style={styles.label}>PAID TO</Text>
        {otherMembers.map((m) => {
          const isSelected = receiverMemberId === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberRow, isSelected && styles.selectedMemberRow]}
              onPress={() => setReceiverMemberId(m.id)}
            >
              <MemberAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={36} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.user.name}</Text>
                {m.user.phone ? <Text style={styles.memberPhone}>{m.user.phone}</Text> : null}
              </View>
              {isSelected ? <Text style={styles.checkText}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}

        {otherMembers.length === 0 ? (
          <Text style={styles.noMembers}>No other members available to pay in this trip.</Text>
        ) : null}
      </View>

      {/* Payment Method */}
      <View style={styles.card}>
        <Text style={styles.label}>PAYMENT METHOD</Text>
        <View style={styles.methodsRow}>
          {PAYMENT_METHODS.map((method) => {
            const isSelected = paymentMethod === method;
            return (
              <TouchableOpacity
                key={method}
                style={[styles.methodBtn, isSelected && styles.selectedMethodBtn]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={[styles.methodText, isSelected && styles.selectedMethodText]}>
                  {method}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 14 }]}>NOTE (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. UPI Ref #123456, Cash handed over"
          value={note}
          onChangeText={setNote}
        />
      </View>

      {/* Confirmation Policy Notice */}
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Receiver Confirmation Required</Text>
        <Text style={styles.noticeText}>
          The receiver must confirm this payment before it affects trip balances. Disputed payments do not alter the ledger.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitBtnText}>Submit Payment</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
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
  title: {
    ...THEME.typography.h1,
    marginBottom: THEME.spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    minWidth: 140,
    textAlign: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: THEME.borderRadius.md,
    marginBottom: 4,
  },
  selectedMemberRow: {
    backgroundColor: THEME.colors.primaryLight,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  memberPhone: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  checkText: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.primaryDark,
  },
  noMembers: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontStyle: 'italic',
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  selectedMethodBtn: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  selectedMethodText: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  noticeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  submitBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 16,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

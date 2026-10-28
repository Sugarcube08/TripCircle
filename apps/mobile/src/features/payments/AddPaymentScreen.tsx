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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
      Alert.alert('Offline Mode', 'Recording payments requires an active network connection.');
      return;
    }

    const amountPaise = Math.round((parseFloat(amountRupees) || 0) * 100);
    if (amountPaise <= 0) {
      Alert.alert('Amount Required', 'Please enter a valid payment amount');
      return;
    }
    if (!receiverMemberId) {
      Alert.alert('Receiver Required', 'Please select who received this payment');
      return;
    }
    if (receiverMemberId === payerMemberId) {
      Alert.alert('Invalid Selection', 'Payer and receiver cannot be the same member');
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
        'Your payment has been recorded as Pending. Group balances will update once the receiver confirms receipt.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Payment Submission Failed', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const addQuickAmount = (increment: number) => {
    const current = parseFloat(amountRupees) || 0;
    setAmountRupees((current + increment).toString());
  };

  if (loading) {
    return <LoadingIndicator message="Loading payment form..." />;
  }

  const otherMembers = members.filter((m) => m.id !== payerMemberId);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Branded Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Record Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>PAYMENT AMOUNT</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={THEME.colors.textLight}
                value={amountRupees}
                onChangeText={setAmountRupees}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            <View style={styles.quickChipsRow}>
              {[500, 1000, 2000, 5000].map((inc) => (
                <TouchableOpacity
                  key={inc}
                  style={styles.quickChip}
                  onPress={() => addQuickAmount(inc)}
                >
                  <Text style={styles.quickChipText}>+{inc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Paid To Selector */}
          <Text style={styles.sectionHeader}>PAID TO</Text>
          <View style={styles.card}>
            {otherMembers.map((m, idx) => {
              const isSelected = receiverMemberId === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.memberRow,
                    isSelected && styles.selectedMemberRow,
                    idx === otherMembers.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => setReceiverMemberId(m.id)}
                  activeOpacity={0.7}
                >
                  <MemberAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={40} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.user.name}</Text>
                    {m.user.phone ? <Text style={styles.memberPhone}>{m.user.phone}</Text> : null}
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
              );
            })}

            {otherMembers.length === 0 && (
              <Text style={styles.noMembers}>No other members available in this trip.</Text>
            )}
          </View>

          {/* Payment Method */}
          <Text style={styles.sectionHeader}>PAYMENT METHOD</Text>
          <View style={styles.methodsRow}>
            {PAYMENT_METHODS.map((method) => {
              const isSelected = paymentMethod === method;
              let iconName: keyof typeof Ionicons.glyphMap = 'phone-portrait-outline';
              if (method === 'CASH') iconName = 'cash-outline';
              else if (method === 'OTHER') iconName = 'card-outline';

              return (
                <TouchableOpacity
                  key={method}
                  style={[styles.methodBtn, isSelected && styles.selectedMethodBtn]}
                  onPress={() => setPaymentMethod(method)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={iconName}
                    size={18}
                    color={isSelected ? THEME.colors.primaryDark : THEME.colors.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.methodText, isSelected && styles.selectedMethodText]}>
                    {method}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note Input */}
          <Text style={styles.sectionHeader}>REFERENCE / NOTE (OPTIONAL)</Text>
          <View style={styles.inputCard}>
            <Ionicons name="document-text-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="e.g. UPI Ref #123456, GPay, Cash handed over"
              placeholderTextColor={THEME.colors.textLight}
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* Policy Notice */}
          <View style={styles.noticeBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#0D9488" style={{ marginRight: 10, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Receiver Confirmation Required</Text>
              <Text style={styles.noticeText}>
                The recipient will receive a verification request. The group ledger and settlement balances only update once confirmed.
              </Text>
            </View>
          </View>

          {/* Submit CTA */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="arrow-forward-circle-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Submit Payment</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: '#FFFFFF',
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
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: THEME.spacing.xs,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: THEME.spacing.xs,
  },
  currencySymbol: {
    fontSize: 34,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 38,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  quickChipsRow: {
    flexDirection: 'row',
    marginTop: THEME.spacing.md,
    gap: 8,
  },
  quickChip: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 8,
    marginTop: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  selectedMemberRow: {
    backgroundColor: '#F0FDFA',
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  memberPhone: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  noMembers: {
    padding: 16,
    textAlign: 'center',
    color: THEME.colors.textMuted,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 12,
    ...THEME.shadows.sm,
  },
  selectedMethodBtn: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1.5,
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  selectedMethodText: {
    color: THEME.colors.primaryDark,
    fontWeight: '700',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    height: 52,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: THEME.borderRadius.md,
    padding: 14,
    marginBottom: THEME.spacing.lg,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 12,
    color: '#115E59',
    lineHeight: 17,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 15,
    ...THEME.shadows.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

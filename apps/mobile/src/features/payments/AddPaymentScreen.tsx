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
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { PAYMENT_METHODS } from '@tripcircle/contracts';
import { apiRequest, getOnlineStatus, uploadImageFromUri, ApiError } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { ScreenHeader, dialog } from '../../components/ui';
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
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = React.useRef<string>(`pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    // Refresh idempotency key only when core payment terms change
    idempotencyKeyRef.current = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, [amountRupees, receiverMemberId, payerMemberId]);

  const pickReceipt = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        dialog.alert('Permission Required', 'Permission to access photos is needed to attach payment proof.', 'warning');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setReceiptUri(res.assets[0].uri);
      }
    } catch (err) {
      dialog.alert('Photo Selection Failed', (err as Error).message, 'error');
    }
  };

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
        dialog.alert('Error', (err as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    }
    loadMembers();
  }, [tripId, user?.id, defaultReceiverMemberId]);

  const handleSubmit = async () => {
    if (submitting) return;

    if (!getOnlineStatus()) {
      dialog.alert('Offline Mode', 'Recording payments requires an active network connection.', 'warning');
      return;
    }

    const amountPaise = Math.round((parseFloat(amountRupees) || 0) * 100);
    if (amountPaise <= 0) {
      dialog.alert('Amount Required', 'Please enter a valid payment amount', 'warning');
      return;
    }
    if (!receiverMemberId) {
      dialog.alert('Receiver Required', 'Please select who received this payment', 'warning');
      return;
    }
    if (receiverMemberId === payerMemberId) {
      dialog.alert('Invalid Selection', 'Payer and receiver cannot be the same member', 'warning');
      return;
    }

    try {
      setSubmitting(true);

      let uploadedReceiptUrl: string | undefined = undefined;
      if (receiptUri) {
        const uploadRes = await uploadImageFromUri(receiptUri, 'PAYMENT_RECEIPT', { tripId });
        uploadedReceiptUrl = uploadRes.publicUrl;
      }

      const createdPayment = await apiRequest(`/trips/${tripId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          payerMemberId,
          receiverMemberId,
          amountPaise,
          paymentMethod,
          note: note.trim() || undefined,
          receiptUrl: uploadedReceiptUrl,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });

      if (createdPayment?.status === 'CONFIRMED') {
        await dialog.alert(
          'Payment Recorded',
          'Payment was automatically confirmed and ledger balances updated.',
          'success'
        );
      } else {
        await dialog.alert(
          'Payment Submitted',
          'Your payment has been recorded as Pending. Group balances will update once the receiver confirms receipt.',
          'success'
        );
      }
      navigation.goBack();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.formatUserMessage() : (err as Error).message;
      dialog.alert('Payment Submission Failed', msg, 'error');
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
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      <ScreenHeader title="Record Payment" onBack={() => navigation.goBack()} />

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

          {/* Paid By Selector */}
          <Text style={styles.sectionHeader}>PAID BY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.membersRow}
          >
            {members.map((m) => {
              const isSelected = payerMemberId === m.id;
              const isYou = m.userId === user?.id;
              const memberName = m.displayName || m.user?.name || 'Member';
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.payerCard, isSelected && styles.selectedPayerCard]}
                  onPress={() => {
                    setPayerMemberId(m.id);
                    if (receiverMemberId === m.id) {
                      const nextOther = members.find((other) => other.id !== m.id);
                      if (nextOther) setReceiverMemberId(nextOther.id);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.avatarWrapper}>
                    <MemberAvatar name={memberName} avatarUrl={m.user?.avatarUrl} size={40} />
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[styles.payerName, isSelected && styles.selectedPayerName]}
                    numberOfLines={1}
                  >
                    {isYou ? 'You' : memberName.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

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
                  <MemberAvatar
                    name={m.displayName || m.user?.name || 'Member'}
                    avatarUrl={m.user?.avatarUrl}
                    size={40}
                  />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.displayName || m.user?.name || 'Member'}</Text>
                    {m.phone || m.user?.phone ? (
                      <Text style={styles.memberPhone}>{m.phone || m.user?.phone}</Text>
                    ) : null}
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

          {/* Payment Proof / Receipt Attachment */}
          <Text style={styles.sectionHeader}>PAYMENT PROOF / RECEIPT (OPTIONAL)</Text>
          <View style={styles.receiptCard}>
            {receiptUri ? (
              <View style={styles.receiptPreviewRow}>
                <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
                <View style={styles.receiptActionsCol}>
                  <TouchableOpacity
                    style={styles.changeReceiptBtn}
                    onPress={pickReceipt}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-outline" size={16} color={THEME.colors.primary} />
                    <Text style={styles.changeReceiptText}>Change Screenshot</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeReceiptBtn}
                    onPress={() => setReceiptUri(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={styles.removeReceiptText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.attachReceiptBtn}
                onPress={pickReceipt}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={20} color={THEME.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.attachReceiptText}>Attach Screenshot / Proof</Text>
              </TouchableOpacity>
            )}
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
            accessibilityRole="button"
            accessibilityLabel="Submit Payment"
          >
            {submitting ? (
              <ActivityIndicator color="#0B0F19" />
            ) : (
              <>
                <Ionicons name="arrow-forward-circle-outline" size={22} color="#0B0F19" style={{ marginRight: 8 }} />
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
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  amountCard: {
    backgroundColor: THEME.colors.surface,
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
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.25)',
    minHeight: 32,
    justifyContent: 'center',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
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
  membersRow: {
    paddingVertical: 6,
    gap: 12,
    marginBottom: THEME.spacing.md,
  },
  payerCard: {
    alignItems: 'center',
    width: 68,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  selectedPayerCard: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight,
  },
  avatarWrapper: {
    position: 'relative',
  },
  selectedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.surface,
  },
  payerName: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  selectedPayerName: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  card: {
    backgroundColor: THEME.colors.surface,
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
    minHeight: 56,
  },
  selectedMemberRow: {
    backgroundColor: THEME.colors.primaryLight,
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
    borderColor: THEME.colors.borderLight,
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
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 12,
    minHeight: 44,
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
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    minHeight: 48,
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
    minHeight: 44,
  },
  receiptCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  attachReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  attachReceiptText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  receiptPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptThumb: {
    width: 64,
    height: 64,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surfaceSubtle,
    marginRight: 14,
  },
  receiptActionsCol: {
    flex: 1,
    gap: 8,
  },
  changeReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 36,
  },
  changeReceiptText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.primary,
    marginLeft: 6,
  },
  removeReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 36,
  },
  removeReceiptText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.debt,
    marginLeft: 6,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.25)',
    borderRadius: THEME.borderRadius.md,
    padding: 14,
    marginBottom: THEME.spacing.lg,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    minHeight: 50,
    ...THEME.shadows.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#0B0F19',
    fontSize: 15,
    fontWeight: '700',
  },
});

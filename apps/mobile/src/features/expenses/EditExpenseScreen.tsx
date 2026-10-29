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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { calculateEqualSplit, validateUnequalSplit } from '@tripcircle/contracts';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { THEME } from '../../theme';

interface EditExpenseScreenProps {
  route: any;
  navigation: any;
}

export const EditExpenseScreen: React.FC<EditExpenseScreenProps> = ({
  route,
  navigation,
}) => {
  const { tripId, expenseId } = route.params;
  const [expense, setExpense] = useState<any>(null);
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [splitMethod, setSplitMethod] = useState<'EQUAL' | 'UNEQUAL'>('EQUAL');
  const [members, setMembers] = useState<any[]>([]);
  const [selectedBeneficiaryIds, setSelectedBeneficiaryIds] = useState<string[]>([]);
  const [unequalShares, setUnequalShares] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [exp, tripData] = await Promise.all([
          apiRequest(`/trips/${tripId}/expenses/${expenseId}`),
          apiRequest(`/trips/${tripId}`),
        ]);

        setExpense(exp);
        setAmountRupees((exp.amountPaise / 100).toFixed(2));
        setDescription(exp.description);
        setSplitMethod(exp.splitMethod);
        setMembers(tripData.members.filter((m: any) => m.status === 'ACTIVE'));

        const allocatedIds = exp.allocations.map((a: any) => a.memberId);
        setSelectedBeneficiaryIds(allocatedIds);

        const sharesMap: Record<string, string> = {};
        for (const a of exp.allocations) {
          sharesMap[a.memberId] = (a.sharePaise / 100).toFixed(2);
        }
        setUnequalShares(sharesMap);
      } catch (err) {
        Alert.alert('Error', (err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tripId, expenseId]);

  const totalAmountPaise = Math.round((parseFloat(amountRupees) || 0) * 100);

  const toggleBeneficiary = (memberId: string) => {
    if (selectedBeneficiaryIds.includes(memberId)) {
      if (selectedBeneficiaryIds.length === 1) {
        Alert.alert('Selection Required', 'At least one beneficiary must be included.');
        return;
      }
      setSelectedBeneficiaryIds(selectedBeneficiaryIds.filter((id) => id !== memberId));
    } else {
      setSelectedBeneficiaryIds([...selectedBeneficiaryIds, memberId]);
    }
  };

  const handleUpdate = async () => {
    if (!amountRupees || totalAmountPaise <= 0) {
      Alert.alert('Required', 'Please enter a valid amount.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter description.');
      return;
    }

    let allocations: { memberId: string; sharePaise: number }[] = [];

    if (splitMethod === 'EQUAL') {
      allocations = calculateEqualSplit(totalAmountPaise, selectedBeneficiaryIds);
    } else {
      allocations = selectedBeneficiaryIds.map((id) => ({
        memberId: id,
        sharePaise: Math.round((parseFloat(unequalShares[id]) || 0) * 100),
      }));

      try {
        validateUnequalSplit(totalAmountPaise, allocations);
      } catch (err) {
        Alert.alert('Allocation Mismatch', (err as Error).message);
        return;
      }
    }

    try {
      setSaving(true);
      await apiRequest(`/trips/${tripId}/expenses/${expenseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          payerMemberId: expense.payerMemberId,
          description: description.trim(),
          amountPaise: totalAmountPaise,
          categoryId: expense.categoryId,
          splitMethod,
          allocations,
          expectedVersion: expense.version,
          changeReason: changeReason.trim() || undefined,
        }),
      });

      Alert.alert('Updated', 'Expense updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Update Failed', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading expense for edit..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      {/* Branded Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Expense</Text>
        <View style={styles.versionBadge}>
          <Text style={styles.versionBadgeText}>v{expense?.version}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Audit Notice */}
          <View style={styles.noticeBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#0369A1" style={{ marginRight: 8 }} />
            <Text style={styles.noticeText}>
              Editing will create version {expense?.version + 1} with an immutable audit log.
            </Text>
          </View>

          {/* Amount Box */}
          <View style={styles.amountCard}>
            <Text style={styles.sectionHeader}>AMOUNT</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amountRupees}
                onChangeText={setAmountRupees}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={THEME.colors.textLight}
              />
            </View>
          </View>

          {/* Description */}
          <Text style={styles.sectionHeader}>DESCRIPTION</Text>
          <View style={styles.inputCard}>
            <Ionicons name="receipt-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={THEME.colors.textLight}
            />
          </View>

          {/* Reason for Edit */}
          <Text style={styles.sectionHeader}>REASON FOR EDIT (AUDIT TRAIL)</Text>
          <View style={styles.inputCard}>
            <Ionicons name="create-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="e.g. Corrected dinner tip, adjusted beneficiaries"
              placeholderTextColor={THEME.colors.textLight}
              value={changeReason}
              onChangeText={setChangeReason}
            />
          </View>

          {/* Split Method Toggle */}
          <Text style={styles.sectionHeader}>SPLIT METHOD</Text>
          <View style={styles.methodToggleCard}>
            <TouchableOpacity
              style={[styles.toggleBtn, splitMethod === 'EQUAL' && styles.activeToggleBtn]}
              onPress={() => setSplitMethod('EQUAL')}
            >
              <Ionicons
                name="pie-chart-outline"
                size={16}
                color={splitMethod === 'EQUAL' ? THEME.colors.primaryDark : THEME.colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.toggleText, splitMethod === 'EQUAL' && styles.activeToggleText]}>
                Equal Split
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, splitMethod === 'UNEQUAL' && styles.activeToggleBtn]}
              onPress={() => setSplitMethod('UNEQUAL')}
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={splitMethod === 'UNEQUAL' ? THEME.colors.primaryDark : THEME.colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.toggleText, splitMethod === 'UNEQUAL' && styles.activeToggleText]}>
                Unequal Split
              </Text>
            </TouchableOpacity>
          </View>

          {/* Beneficiaries List */}
          <Text style={styles.sectionHeader}>BENEFICIARIES</Text>
          <View style={styles.beneficiariesCard}>
            {members.map((m, index) => {
              const isIncluded = selectedBeneficiaryIds.includes(m.id);
              return (
                <View
                  key={m.id}
                  style={[
                    styles.beneficiaryRow,
                    index === members.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.beneficiaryLeft}
                    onPress={() => toggleBeneficiary(m.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isIncluded && styles.checkboxActive]}>
                      {isIncluded && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <MemberAvatar
                      name={m.displayName || m.user?.name || 'Member'}
                      avatarUrl={m.user?.avatarUrl}
                      size={36}
                    />
                    <Text style={[styles.beneficiaryName, !isIncluded && styles.textDisabled]}>
                      {m.displayName || m.user?.name || 'Member'}
                    </Text>
                  </TouchableOpacity>

                  {splitMethod === 'UNEQUAL' ? (
                    <View style={styles.unequalInputWrapper}>
                      <Text style={styles.rupeeInputPrefix}>₹</Text>
                      <TextInput
                        style={styles.unequalInputField}
                        value={unequalShares[m.id] || ''}
                        onChangeText={(val) => setUnequalShares({ ...unequalShares, [m.id]: val })}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={THEME.colors.textMuted}
                        editable={isIncluded}
                      />
                    </View>
                  ) : (
                    <Text style={[styles.shareValueText, !isIncluded && styles.textDisabled]}>
                      {isIncluded && selectedBeneficiaryIds.length > 0
                        ? `₹${(totalAmountPaise / selectedBeneficiaryIds.length / 100).toFixed(2)}`
                        : '₹0.00'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Save Action */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleUpdate}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save Revision</Text>
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
  versionBadge: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
  },
  versionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.mint,
  },
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderColor: 'rgba(14, 165, 233, 0.3)',
    borderWidth: 1,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: THEME.spacing.md,
  },
  noticeText: {
    fontSize: 13,
    color: THEME.colors.cyan,
    flexShrink: 1,
    lineHeight: 18,
  },
  amountCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
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
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.inputBg,
    borderWidth: 1,
    borderColor: THEME.colors.inputBorder,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    height: 52,
    marginBottom: 8,
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
  methodToggleCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.inputBg,
    borderRadius: THEME.borderRadius.md,
    padding: 4,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.sm,
  },
  activeToggleBtn: {
    backgroundColor: THEME.colors.cardAlt,
    ...THEME.shadows.sm,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  activeToggleText: {
    color: THEME.colors.mint,
    fontWeight: '700',
  },
  beneficiariesCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
    ...THEME.shadows.sm,
  },
  beneficiaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  beneficiaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  beneficiaryName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginLeft: 10,
  },
  textDisabled: {
    color: THEME.colors.textLight,
  },
  shareValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  unequalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.inputBg,
    borderWidth: 1,
    borderColor: THEME.colors.inputBorder,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 8,
    height: 36,
  },
  rupeeInputPrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    marginRight: 4,
  },
  unequalInputField: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    minWidth: 64,
    textAlign: 'right',
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  saveBtn: {
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
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

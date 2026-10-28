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
import { apiRequest } from '../../services/api';
import { calculateEqualSplit, validateUnequalSplit } from '@tripcircle/contracts';
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
        Alert.alert('At least one beneficiary is required');
        return;
      }
      setSelectedBeneficiaryIds(selectedBeneficiaryIds.filter((id) => id !== memberId));
    } else {
      setSelectedBeneficiaryIds([...selectedBeneficiaryIds, memberId]);
    }
  };

  const handleUpdate = async () => {
    if (!amountRupees || totalAmountPaise <= 0) {
      Alert.alert('Required', 'Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter description');
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Edit Expense (v{expense?.version})</Text>
        <Text style={styles.subtitle}>
          Editing creates a new auditable revision while instantly updating balances.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>AMOUNT (₹)</Text>
          <TextInput
            style={styles.amountInput}
            value={amountRupees}
            onChangeText={setAmountRupees}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>REASON FOR EDIT (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Corrected amount, adjusted beneficiaries"
            value={changeReason}
            onChangeText={setChangeReason}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>SPLIT METHOD</Text>
          <View style={styles.methodToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, splitMethod === 'EQUAL' && styles.activeToggleBtn]}
              onPress={() => setSplitMethod('EQUAL')}
            >
              <Text style={[styles.toggleText, splitMethod === 'EQUAL' && styles.activeToggleText]}>
                Equal Split
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, splitMethod === 'UNEQUAL' && styles.activeToggleBtn]}
              onPress={() => setSplitMethod('UNEQUAL')}
            >
              <Text style={[styles.toggleText, splitMethod === 'UNEQUAL' && styles.activeToggleText]}>
                Unequal Split
              </Text>
            </TouchableOpacity>
          </View>

          {/* Beneficiaries Selection */}
          <Text style={[styles.label, { marginTop: 12 }]}>BENEFICIARIES</Text>
          {members.map((m) => {
            const isIncluded = selectedBeneficiaryIds.includes(m.id);
            return (
              <View key={m.id} style={styles.beneficiaryRow}>
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => toggleBeneficiary(m.id)}
                >
                  <Text style={[styles.checkText, isIncluded && styles.checkActive]}>
                    {isIncluded ? '✓' : '○'}
                  </Text>
                  <Text style={styles.memberName}>{m.user.name}</Text>
                </TouchableOpacity>

                {splitMethod === 'UNEQUAL' ? (
                  <View style={styles.unequalInputWrapper}>
                    <Text style={{ marginRight: 2 }}>₹</Text>
                    <TextInput
                      style={styles.unequalInput}
                      value={unequalShares[m.id] || ''}
                      onChangeText={(val) => setUnequalShares({ ...unequalShares, [m.id]: val })}
                      keyboardType="decimal-pad"
                      editable={isIncluded}
                    />
                  </View>
                ) : (
                  <Text style={styles.shareText}>
                    {isIncluded && selectedBeneficiaryIds.length > 0
                      ? `₹${(totalAmountPaise / selectedBeneficiaryIds.length / 100).toFixed(2)}`
                      : '₹0.00'}
                  </Text>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleUpdate}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Revision</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    ...THEME.typography.h2,
    marginBottom: 4,
  },
  subtitle: {
    ...THEME.typography.bodySmall,
    marginBottom: THEME.spacing.md,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  amountInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeToggleBtn: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  activeToggleText: {
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  beneficiaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 18,
    color: '#94A3B8',
    marginRight: 10,
  },
  checkActive: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  shareText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  unequalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    width: 90,
  },
  unequalInput: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
    flex: 1,
  },
  saveBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.lg,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

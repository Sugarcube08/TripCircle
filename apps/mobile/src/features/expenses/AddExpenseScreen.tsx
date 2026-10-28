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
import { EXPENSE_CATEGORIES, calculateEqualSplit } from '@tripcircle/contracts';
import { apiRequest, getOnlineStatus } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { THEME } from '../../theme';

interface AddExpenseScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const AddExpenseScreen: React.FC<AddExpenseScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId } = route.params;
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(EXPENSE_CATEGORIES[0].key);
  const [payerMemberId, setPayerMemberId] = useState<string>('');
  const [splitMethod, setSplitMethod] = useState<'EQUAL' | 'UNEQUAL'>('EQUAL');
  const [members, setMembers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedBeneficiaryIds, setSelectedBeneficiaryIds] = useState<string[]>([]);
  const [unequalShares, setUnequalShares] = useState<Record<string, string>>({});
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    async function loadMembers() {
      try {
        const [tripData, catsData] = await Promise.all([
          apiRequest(`/trips/${tripId}`),
          apiRequest('/categories').catch(() => EXPENSE_CATEGORIES),
        ]);

        const activeMembers = tripData.members.filter((m: any) => m.status === 'ACTIVE');
        setMembers(activeMembers);
        setCategories(catsData || EXPENSE_CATEGORIES);

        // Default payer: current user's membership
        const myMember = activeMembers.find((m: any) => m.userId === user?.id);
        if (myMember) {
          setPayerMemberId(myMember.id);
        } else if (activeMembers.length > 0) {
          setPayerMemberId(activeMembers[0].id);
        }

        // Default beneficiaries: all active members
        setSelectedBeneficiaryIds(activeMembers.map((m: any) => m.id));
      } catch (err) {
        Alert.alert('Error', (err as Error).message);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadMembers();
  }, [tripId, user?.id]);

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

  const selectAllBeneficiaries = () => {
    setSelectedBeneficiaryIds(members.map((m) => m.id));
  };

  // Unequal allocation calculations
  const totalAllocatedPaise = splitMethod === 'UNEQUAL'
    ? selectedBeneficiaryIds.reduce((sum, id) => {
        const val = Math.round((parseFloat(unequalShares[id]) || 0) * 100);
        return sum + val;
      }, 0)
    : totalAmountPaise;

  const unallocatedPaise = totalAmountPaise - totalAllocatedPaise;

  const handleSave = async () => {
    if (!getOnlineStatus()) {
      Alert.alert('Offline', 'Transaction submission requires internet connectivity.');
      return;
    }

    if (!amountRupees || totalAmountPaise <= 0) {
      Alert.alert('Required', 'Please enter a valid expense amount');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter what the expense was for');
      return;
    }
    if (!payerMemberId) {
      Alert.alert('Required', 'Please select who paid for this expense');
      return;
    }
    if (selectedBeneficiaryIds.length === 0) {
      Alert.alert('Required', 'Please select at least one beneficiary');
      return;
    }

    let allocations: { memberId: string; sharePaise: number }[] = [];

    if (splitMethod === 'EQUAL') {
      try {
        allocations = calculateEqualSplit(totalAmountPaise, selectedBeneficiaryIds);
      } catch (err) {
        Alert.alert('Calculation Error', (err as Error).message);
        return;
      }
    } else {
      if (unallocatedPaise !== 0) {
        Alert.alert(
          'Allocation Mismatch',
          `The sum of all member shares must exactly equal ₹${(totalAmountPaise / 100).toFixed(2)}. Currently ${unallocatedPaise > 0 ? `remaining: ₹${(unallocatedPaise / 100).toFixed(2)}` : `exceeded by ₹${(Math.abs(unallocatedPaise) / 100).toFixed(2)}`}.`
        );
        return;
      }

      allocations = selectedBeneficiaryIds.map((id) => ({
        memberId: id,
        sharePaise: Math.round((parseFloat(unequalShares[id]) || 0) * 100),
      }));
    }

    // Find category ID
    const cat = categories.find((c) => c.key === selectedCategory) || categories[0];

    try {
      setLoading(true);
      await apiRequest(`/trips/${tripId}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          payerMemberId,
          description: description.trim(),
          amountPaise: totalAmountPaise,
          categoryId: cat.id,
          splitMethod,
          allocations,
          location: location.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });

      navigation.goBack();
    } catch (err) {
      Alert.alert('Failed to Save Expense', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingInitial) {
    return <LoadingIndicator message="Preparing expense form..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Amount Input */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>AMOUNT</Text>
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

        {/* Category Pills */}
        <Text style={styles.fieldLabel}>WHAT WAS IT FOR?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {EXPENSE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryPill,
                selectedCategory === cat.key && styles.selectedCategoryPill,
              ]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === cat.key && styles.selectedCategoryText,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Description */}
        <Text style={styles.fieldLabel}>DESCRIPTION</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dinner at Fisherman's Wharf, Taxi to airport"
          placeholderTextColor="#94A3B8"
          value={description}
          onChangeText={setDescription}
        />

        {/* Who Paid */}
        <Text style={styles.fieldLabel}>WHO PAID?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersRow}>
          {members.map((m) => {
            const isSelected = payerMemberId === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.memberSelectCard, isSelected && styles.selectedMemberCard]}
                onPress={() => setPayerMemberId(m.id)}
              >
                <MemberAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={36} />
                <Text style={[styles.memberSelectName, isSelected && styles.selectedMemberText]} numberOfLines={1}>
                  {m.userId === user?.id ? 'You' : m.user.name.split(' ')[0]}
                </Text>
                {isSelected ? <Text style={styles.checkMark}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Split Section */}
        <View style={styles.splitHeader}>
          <Text style={styles.fieldLabel}>SPLIT WITH</Text>
          <TouchableOpacity onPress={selectAllBeneficiaries}>
            <Text style={styles.selectAllText}>Select Everyone</Text>
          </TouchableOpacity>
        </View>

        {/* Split Method Toggle: Equal vs Unequal */}
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

        {/* Unequal split remaining counter */}
        {splitMethod === 'UNEQUAL' && totalAmountPaise > 0 ? (
          <View style={[styles.unallocatedBanner, unallocatedPaise !== 0 && styles.unallocatedError]}>
            <Text style={styles.unallocatedText}>
              {unallocatedPaise === 0
                ? '✓ Exactly allocated'
                : unallocatedPaise > 0
                ? `Remaining unallocated: ₹${(unallocatedPaise / 100).toFixed(2)}`
                : `Over-allocated by: ₹${(Math.abs(unallocatedPaise) / 100).toFixed(2)}`}
            </Text>
          </View>
        ) : null}

        {/* Beneficiaries List */}
        <View style={styles.beneficiariesCard}>
          {members.map((m) => {
            const isIncluded = selectedBeneficiaryIds.includes(m.id);
            const equalShare = totalAmountPaise > 0 && selectedBeneficiaryIds.length > 0
              ? (totalAmountPaise / selectedBeneficiaryIds.length / 100).toFixed(2)
              : '0.00';

            return (
              <View key={m.id} style={styles.beneficiaryRow}>
                <TouchableOpacity
                  style={styles.beneficiaryCheck}
                  onPress={() => toggleBeneficiary(m.id)}
                >
                  <View style={[styles.checkbox, isIncluded && styles.checkboxActive]}>
                    {isIncluded ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                  </View>
                  <MemberAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={32} />
                  <Text style={styles.beneficiaryName}>
                    {m.userId === user?.id ? 'You' : m.user.name}
                  </Text>
                </TouchableOpacity>

                {splitMethod === 'EQUAL' ? (
                  <Text style={[styles.shareValue, !isIncluded && styles.shareDisabled]}>
                    {isIncluded ? `₹${equalShare}` : '₹0.00'}
                  </Text>
                ) : (
                  <View style={styles.unequalInputWrapper}>
                    <Text style={styles.rupeePrefix}>₹</Text>
                    <TextInput
                      style={styles.unequalInput}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={unequalShares[m.id] || ''}
                      onChangeText={(val) => setUnequalShares({ ...unequalShares, [m.id]: val })}
                      editable={isIncluded}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Location & Note */}
        <Text style={styles.fieldLabel}>LOCATION (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          placeholder="Restaurant / shop / location"
          placeholderTextColor="#94A3B8"
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.fieldLabel}>NOTE (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          placeholder="Add any extra details..."
          placeholderTextColor="#94A3B8"
          value={note}
          onChangeText={setNote}
          multiline
        />

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save Expense</Text>
          )}
        </TouchableOpacity>
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
  amountBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  categoryPill: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  selectedCategoryPill: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  membersRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  memberSelectCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    width: 80,
  },
  selectedMemberCard: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight,
  },
  memberSelectName: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  selectedMemberText: {
    color: THEME.colors.primaryDark,
    fontWeight: '700',
  },
  checkMark: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: 10,
    color: THEME.colors.primaryDark,
    fontWeight: '800',
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: THEME.borderRadius.md,
    padding: 3,
    marginVertical: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.borderRadius.sm,
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
  unallocatedBanner: {
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: THEME.borderRadius.md,
    marginBottom: 10,
  },
  unallocatedError: {
    backgroundColor: '#FEF2F2',
  },
  unallocatedText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    color: THEME.colors.textPrimary,
  },
  beneficiariesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  beneficiaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  beneficiaryCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  beneficiaryName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginLeft: 10,
  },
  shareValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  shareDisabled: {
    color: THEME.colors.textMuted,
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
  rupeePrefix: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginRight: 2,
  },
  unequalInput: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
    flex: 1,
    color: THEME.colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 16,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.xl,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

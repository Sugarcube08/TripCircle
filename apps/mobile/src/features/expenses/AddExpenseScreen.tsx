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
import { EXPENSE_CATEGORIES, calculateEqualSplit } from '@tripcircle/contracts';
import { apiRequest, getOnlineStatus } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { dialog } from '../../components/ui';
import { THEME } from '../../theme';

interface AddExpenseScreenProps {
  route: any;
  navigation: any;
  user: any;
}

function getCategoryConfig(key: string) {
  const k = (key || '').toLowerCase();
  if (k.includes('food') || k.includes('dinner') || k.includes('meal')) {
    return { icon: 'restaurant-outline' as const, color: '#F97316', bg: '#FFF7ED' };
  }
  if (k.includes('stay') || k.includes('hotel') || k.includes('resort')) {
    return { icon: 'bed-outline' as const, color: '#8B5CF6', bg: '#F5F3FF' };
  }
  if (k.includes('travel') || k.includes('transport') || k.includes('cab')) {
    return { icon: 'car-outline' as const, color: '#3B82F6', bg: '#EFF6FF' };
  }
  if (k.includes('drink') || k.includes('beverage') || k.includes('bar')) {
    return { icon: 'cafe-outline' as const, color: '#EC4899', bg: '#FDF2F8' };
  }
  if (k.includes('activity') || k.includes('entertainment')) {
    return { icon: 'ticket-outline' as const, color: '#10B981', bg: '#ECFDF5' };
  }
  if (k.includes('shopping')) {
    return { icon: 'bag-handle-outline' as const, color: '#F59E0B', bg: '#FFFBEB' };
  }
  return { icon: 'receipt-outline' as const, color: '#0D9488', bg: '#F0FDFA' };
}

export const AddExpenseScreen: React.FC<AddExpenseScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId } = route.params;
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(EXPENSE_CATEGORIES[0]?.key || 'FOOD');
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
        dialog.alert('Error', (err as Error).message, 'error');
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
        dialog.alert('Selection Required', 'At least one beneficiary must be included.', 'warning');
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

  const addQuickAmount = (increment: number) => {
    const current = parseFloat(amountRupees) || 0;
    setAmountRupees((current + increment).toString());
  };

  const handleSave = async () => {
    if (!getOnlineStatus()) {
      dialog.alert('Offline Mode', 'Transaction submission requires active network connectivity.', 'warning');
      return;
    }

    if (!amountRupees || totalAmountPaise <= 0) {
      dialog.alert('Amount Required', 'Please enter a valid expense amount in rupees.', 'warning');
      return;
    }
    if (!description.trim()) {
      dialog.alert('Description Required', 'Please enter a description for this expense.', 'warning');
      return;
    }
    if (!payerMemberId) {
      dialog.alert('Payer Required', 'Please select who paid for this expense.', 'warning');
      return;
    }
    if (selectedBeneficiaryIds.length === 0) {
      dialog.alert('Beneficiaries Required', 'Please select at least one person sharing this expense.', 'warning');
      return;
    }

    let allocations: { memberId: string; sharePaise: number }[] = [];

    if (splitMethod === 'EQUAL') {
      try {
        allocations = calculateEqualSplit(totalAmountPaise, selectedBeneficiaryIds);
      } catch (err) {
        dialog.alert('Calculation Error', (err as Error).message, 'error');
        return;
      }
    } else {
      if (unallocatedPaise !== 0) {
        dialog.alert(
          'Allocation Mismatch',
          `The sum of all member shares must exactly equal ₹${(totalAmountPaise / 100).toFixed(2)}. Currently ${unallocatedPaise > 0 ? `remaining: ₹${(unallocatedPaise / 100).toFixed(2)}` : `exceeded by ₹${(Math.abs(unallocatedPaise) / 100).toFixed(2)}`}.`,
          'warning'
        );
        return;
      }

      allocations = selectedBeneficiaryIds.map((id) => ({
        memberId: id,
        sharePaise: Math.round((parseFloat(unequalShares[id]) || 0) * 100),
      }));
    }

    const cat = categories.find((c) => c.key === selectedCategory) || categories[0] || EXPENSE_CATEGORIES[0];

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
      dialog.alert('Failed to Save Expense', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingInitial) {
    return <LoadingIndicator message="Preparing expense form..." />;
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
        <Text style={styles.headerTitle}>Add Expense</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>EXPENSE AMOUNT</Text>
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
            {/* Quick Increment Chips */}
            <View style={styles.quickChipsRow}>
              {[100, 250, 500, 1000].map((inc) => (
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

          {/* Category Strip */}
          <Text style={styles.sectionHeader}>CATEGORY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {EXPENSE_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              const cfg = getCategoryConfig(cat.key);
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryPill,
                    isSelected && { backgroundColor: cfg.bg, borderColor: cfg.color, borderWidth: 1.5 },
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.categoryIconCircle, { backgroundColor: isSelected ? cfg.color : '#F1F5F9' }]}>
                    <Ionicons
                      name={cfg.icon}
                      size={16}
                      color={isSelected ? '#FFFFFF' : THEME.colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected && { color: cfg.color, fontWeight: '700' },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Description Input */}
          <Text style={styles.sectionHeader}>DESCRIPTION</Text>
          <View style={styles.inputCard}>
            <Ionicons name="receipt-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="e.g. Seafood Dinner, Taxi to airport, Groceries"
              placeholderTextColor={THEME.colors.textLight}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Payer Selector */}
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
                  onPress={() => setPayerMemberId(m.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.avatarWrapper}>
                    <MemberAvatar name={memberName} avatarUrl={m.user?.avatarUrl} size={44} />
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

          {/* Split Section */}
          <View style={styles.splitHeaderRow}>
            <Text style={styles.sectionHeader}>SPLIT WITH</Text>
            <TouchableOpacity onPress={selectAllBeneficiaries} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.selectAllLink}>Select Everyone</Text>
            </TouchableOpacity>
          </View>

          {/* Split Method Toggle */}
          <View style={styles.methodToggleCard}>
            <TouchableOpacity
              style={[styles.toggleBtn, splitMethod === 'EQUAL' && styles.activeToggleBtn]}
              onPress={() => setSplitMethod('EQUAL')}
              activeOpacity={0.8}
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
              activeOpacity={0.8}
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

          {/* Unequal allocation validation indicator */}
          {splitMethod === 'UNEQUAL' && totalAmountPaise > 0 && (
            <View
              style={[
                styles.allocationBanner,
                unallocatedPaise === 0 ? styles.allocationBannerSuccess : styles.allocationBannerAlert,
              ]}
            >
              <Ionicons
                name={unallocatedPaise === 0 ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={unallocatedPaise === 0 ? THEME.colors.credit : THEME.colors.debt}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.allocationBannerText,
                  { color: unallocatedPaise === 0 ? THEME.colors.credit : THEME.colors.debt },
                ]}
              >
                {unallocatedPaise === 0
                  ? 'Total matches exact expense amount'
                  : unallocatedPaise > 0
                  ? `Remaining to allocate: ₹${(unallocatedPaise / 100).toFixed(2)}`
                  : `Over-allocated by: ₹${(Math.abs(unallocatedPaise) / 100).toFixed(2)}`}
              </Text>
            </View>
          )}

          {/* Beneficiaries List */}
          <View style={styles.beneficiariesCard}>
            {members.map((m, index) => {
              const isIncluded = selectedBeneficiaryIds.includes(m.id);
              const isYou = m.userId === user?.id;
              const equalShare =
                totalAmountPaise > 0 && selectedBeneficiaryIds.length > 0
                  ? (totalAmountPaise / selectedBeneficiaryIds.length / 100).toFixed(2)
                  : '0.00';

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
                    <View style={styles.beneficiaryInfo}>
                      <Text style={[styles.beneficiaryName, !isIncluded && styles.textDisabled]}>
                        {m.displayName || m.user?.name || 'Member'} {isYou ? '(You)' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {splitMethod === 'EQUAL' ? (
                    <Text style={[styles.shareValueText, !isIncluded && styles.textDisabled]}>
                      {isIncluded ? `₹${equalShare}` : '₹0.00'}
                    </Text>
                  ) : (
                    <View style={styles.unequalInputWrapper}>
                      <Text style={styles.rupeeInputPrefix}>₹</Text>
                      <TextInput
                        style={styles.unequalInputField}
                        placeholder="0.00"
                        placeholderTextColor={THEME.colors.textLight}
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

          {/* Optional Details Card */}
          <Text style={styles.sectionHeader}>EXTRA DETAILS (OPTIONAL)</Text>
          <View style={styles.optionalCard}>
            <View style={styles.optionalRow}>
              <Ionicons name="location-outline" size={18} color={THEME.colors.textMuted} style={styles.optIcon} />
              <TextInput
                style={styles.optInput}
                placeholder="Location (e.g. Candolim Beach)"
                placeholderTextColor={THEME.colors.textLight}
                value={location}
                onChangeText={setLocation}
              />
            </View>
            <View style={styles.cardDivider} />
            <View style={styles.optionalRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={THEME.colors.textMuted} style={styles.optIcon} />
              <TextInput
                style={[styles.optInput, { minHeight: 48 }]}
                placeholder="Notes or details..."
                placeholderTextColor={THEME.colors.textLight}
                value={note}
                onChangeText={setNote}
                multiline
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.btnDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-sharp" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save Expense</Text>
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
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl + 20,
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
    marginTop: 12,
    marginLeft: 4,
  },
  categoryRow: {
    paddingRight: THEME.spacing.md,
    gap: 8,
    marginBottom: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  categoryIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  categoryPillText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontWeight: '600',
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
    marginBottom: 4,
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
  membersRow: {
    paddingRight: THEME.spacing.md,
    gap: 12,
    marginBottom: 4,
  },
  payerCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    alignItems: 'center',
    width: 78,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  selectedPayerCard: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1.5,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  selectedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: THEME.colors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  payerName: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  selectedPayerName: {
    color: THEME.colors.primaryDark,
    fontWeight: '700',
  },
  splitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  selectAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  methodToggleCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: THEME.borderRadius.md,
    padding: 4,
    marginBottom: THEME.spacing.md,
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
    backgroundColor: THEME.colors.card,
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
  allocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
  },
  allocationBannerSuccess: {
    backgroundColor: THEME.colors.creditBg,
    borderColor: THEME.colors.creditBorder || '#A7F3D0',
  },
  allocationBannerAlert: {
    backgroundColor: THEME.colors.debtBg,
    borderColor: THEME.colors.debtBorder || '#FECACA',
  },
  allocationBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  beneficiariesCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
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
  beneficiaryInfo: {
    marginLeft: 10,
    flex: 1,
  },
  beneficiaryName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  textDisabled: {
    color: THEME.colors.textMuted,
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
  optionalCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
    ...THEME.shadows.sm,
  },
  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  optIcon: {
    marginRight: 10,
  },
  optInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { EXPENSE_CATEGORIES, calculateEqualSplit } from '@tripcircle/contracts';
import { apiRequest, getOnlineStatus, uploadImageFromUri, ApiError } from '../../services/api';
import { resolveMediaUrl } from '../../utils/media';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { ScreenHeader, dialog } from '../../components/ui';
import { THEME, getCategoryConfig } from '../../theme';

interface EditExpenseScreenProps {
  route: any;
  navigation: any;
  user?: any;
}

export const EditExpenseScreen: React.FC<EditExpenseScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId, expenseId } = route.params;
  const [expense, setExpense] = useState<any>(null);
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('FOOD');
  const [payerMemberId, setPayerMemberId] = useState<string>('');
  const [splitMethod, setSplitMethod] = useState<'EQUAL' | 'UNEQUAL'>('EQUAL');
  const [members, setMembers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedBeneficiaryIds, setSelectedBeneficiaryIds] = useState<string[]>([]);
  const [unequalShares, setUnequalShares] = useState<Record<string, string>>({});
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const [newReceiptUri, setNewReceiptUri] = useState<string | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const pickReceipt = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        dialog.alert('Permission Required', 'Permission to access photos is needed to update the receipt.', 'warning');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setNewReceiptUri(res.assets[0].uri);
        setRemoveReceipt(false);
      }
    } catch (err) {
      dialog.alert('Photo Selection Failed', (err as Error).message, 'error');
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [exp, tripData, catsData] = await Promise.all([
          apiRequest(`/trips/${tripId}/expenses/${expenseId}`),
          apiRequest(`/trips/${tripId}`),
          apiRequest('/categories').catch(() => []),
        ]);

        setExpense(exp);
        setAmountRupees((exp.amountPaise / 100).toFixed(2));
        setDescription(exp.description || '');
        setSelectedCategory(exp.categoryId || exp.category?.key || exp.category?.id || 'FOOD');
        setPayerMemberId(exp.payerMemberId);
        setSplitMethod(exp.splitMethod || 'EQUAL');
        setLocation(exp.location || '');
        setNote(exp.note || '');

        const activeMembers = tripData.members.filter((m: any) => m.status === 'ACTIVE');
        setMembers(activeMembers);

        const validCats = Array.isArray(catsData) && catsData.length > 0 ? catsData : [];
        setCategories(validCats);

        if (exp.receiptUrl) {
          setExistingReceiptUrl(exp.receiptUrl);
        }

        const allocatedIds = (exp.allocations || []).map((a: any) => a.memberId);
        setSelectedBeneficiaryIds(allocatedIds);

        const sharesMap: Record<string, string> = {};
        for (const a of exp.allocations || []) {
          sharesMap[a.memberId] = (a.sharePaise / 100).toFixed(2);
        }
        setUnequalShares(sharesMap);
      } catch (err) {
        dialog.alert('Error', (err as Error).message, 'error');
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

  const handleSplitMethodChange = (newMethod: 'EQUAL' | 'UNEQUAL') => {
    setSplitMethod(newMethod);
    if (newMethod === 'UNEQUAL' && totalAmountPaise > 0 && selectedBeneficiaryIds.length > 0) {
      const currentSum = selectedBeneficiaryIds.reduce((sum, id) => {
        return sum + Math.round((parseFloat(unequalShares[id]) || 0) * 100);
      }, 0);
      if (currentSum !== totalAmountPaise) {
        try {
          const equalAllocs = calculateEqualSplit(totalAmountPaise, selectedBeneficiaryIds);
          const newShares: Record<string, string> = { ...unequalShares };
          for (const a of equalAllocs) {
            newShares[a.memberId] = (a.sharePaise / 100).toFixed(2);
          }
          setUnequalShares(newShares);
        } catch {
          // ignore
        }
      }
    }
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

  const handleUpdate = async () => {
    if (saving) return;

    if (!getOnlineStatus()) {
      dialog.alert('Offline Mode', 'Transaction updates require active network connectivity.', 'warning');
      return;
    }

    if (!amountRupees || totalAmountPaise <= 0) {
      dialog.alert('Amount Required', 'Please enter a valid expense amount.', 'warning');
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

    const cat = categories.find((c) => c.key === selectedCategory || c.id === selectedCategory)
      || categories.find((c) => c.id)
      || categories[0];
    const categoryId = cat?.id || cat?.key || selectedCategory || 'FOOD';

    try {
      setSaving(true);

      let finalReceiptUrl: string | null | undefined = existingReceiptUrl;
      if (removeReceipt) {
        finalReceiptUrl = null;
      } else if (newReceiptUri) {
        const uploadRes = await uploadImageFromUri(newReceiptUri, 'EXPENSE_RECEIPT', {
          tripId,
          expenseId,
        });
        finalReceiptUrl = uploadRes.publicUrl;
      }

      await apiRequest(`/trips/${tripId}/expenses/${expenseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          payerMemberId,
          description: description.trim() || undefined,
          amountPaise: totalAmountPaise,
          categoryId,
          splitMethod,
          allocations,
          expectedVersion: expense.version,
          changeReason: changeReason.trim() || undefined,
          receiptUrl: finalReceiptUrl,
          location: location.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });

      await dialog.alert('Updated', 'Expense updated successfully.', 'success');
      navigation.goBack();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.formatUserMessage() : (err as Error).message;
      dialog.alert('Update Failed', msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading expense for edit..." />;
  }

  const displayedReceiptUri = !removeReceipt
    ? newReceiptUri || (existingReceiptUrl ? resolveMediaUrl(existingReceiptUrl) : null)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      <ScreenHeader
        title="Edit Expense"
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>v{expense?.version}</Text>
          </View>
        }
      />

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
            <Ionicons name="information-circle-outline" size={18} color={THEME.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.noticeText}>
              Editing will create version {(expense?.version || 1) + 1} with an immutable audit log.
            </Text>
          </View>

          {/* Amount Box */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>EXPENSE AMOUNT</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amountRupees}
                onChangeText={setAmountRupees}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={THEME.colors.textLight}
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
            {(categories.length > 0 ? categories : EXPENSE_CATEGORIES).map((cat: any) => {
              const catKey = cat.key || cat.id;
              const isSelected = selectedCategory === catKey || selectedCategory === cat.id;
              const cfg = getCategoryConfig(catKey);
              return (
                <TouchableOpacity
                  key={cat.id || cat.key}
                  style={[
                    styles.categoryPill,
                    isSelected && { backgroundColor: cfg.bg, borderColor: cfg.color, borderWidth: 1.5 },
                  ]}
                  onPress={() => setSelectedCategory(cat.key || cat.id)}
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

          {/* Description */}
          <Text style={styles.sectionHeader}>DESCRIPTION (OPTIONAL)</Text>
          <View style={styles.inputCard}>
            <Ionicons name="receipt-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Seafood Dinner, Taxi (optional)"
              placeholderTextColor={THEME.colors.textLight}
              maxLength={200}
            />
          </View>

          {/* Paid By (Payee Selector) */}
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
              onPress={() => handleSplitMethodChange('EQUAL')}
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
              onPress={() => handleSplitMethodChange('UNEQUAL')}
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

          {/* Reason for Edit (Audit Trail) */}
          <Text style={styles.sectionHeader}>REASON FOR EDIT (AUDIT TRAIL)</Text>
          <View style={styles.inputCard}>
            <Ionicons name="create-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="e.g. Changed payer, corrected dinner split"
              placeholderTextColor={THEME.colors.textLight}
              value={changeReason}
              onChangeText={setChangeReason}
              maxLength={255}
            />
          </View>

          {/* Extra Details */}
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

          {/* Receipt Section */}
          <Text style={styles.sectionHeader}>RECEIPT ATTACHMENT</Text>
          <View style={styles.receiptCard}>
            {displayedReceiptUri ? (
              <View style={styles.receiptPreviewRow}>
                <Image source={{ uri: displayedReceiptUri }} style={styles.receiptThumb} />
                <View style={styles.receiptActionsCol}>
                  <TouchableOpacity
                    style={styles.changeReceiptBtn}
                    onPress={pickReceipt}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-outline" size={16} color={THEME.colors.primary} />
                    <Text style={styles.changeReceiptText}>Change Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeReceiptBtn}
                    onPress={() => {
                      setNewReceiptUri(null);
                      setRemoveReceipt(true);
                    }}
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
                <Text style={styles.attachReceiptText}>Attach Receipt Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Save Action */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleUpdate}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#0B0F19" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#0B0F19" style={{ marginRight: 6 }} />
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
  versionBadge: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.25)',
  },
  versionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 160, 0.08)',
    borderColor: 'rgba(0, 245, 160, 0.25)',
    borderWidth: 1,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: THEME.spacing.md,
  },
  noticeText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    flexShrink: 1,
    lineHeight: 18,
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
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    marginBottom: 4,
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
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: THEME.spacing.sm,
  },
  quickChip: {
    backgroundColor: THEME.colors.surfaceSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  categoryRow: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 8,
    marginBottom: THEME.spacing.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginRight: 6,
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
    fontWeight: '600',
    color: THEME.colors.textSecondary,
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
    minHeight: 44,
  },
  membersRow: {
    paddingVertical: 4,
    gap: 12,
    marginBottom: THEME.spacing.md,
  },
  payerCard: {
    alignItems: 'center',
    padding: 10,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    minWidth: 72,
    marginRight: 8,
  },
  selectedPayerCard: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(0, 245, 160, 0.08)',
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
    maxWidth: 64,
    textAlign: 'center',
  },
  selectedPayerName: {
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  splitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: THEME.spacing.xs,
  },
  selectAllLink: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  methodToggleCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    padding: 4,
    marginVertical: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.sm,
  },
  activeToggleBtn: {
    backgroundColor: THEME.colors.surface,
    ...THEME.shadows.sm,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  activeToggleText: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  allocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.sm,
  },
  allocationBannerSuccess: {
    backgroundColor: THEME.colors.creditBg,
  },
  allocationBannerAlert: {
    backgroundColor: THEME.colors.debtBg,
  },
  allocationBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  beneficiariesCard: {
    backgroundColor: THEME.colors.surface,
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
    minHeight: 52,
  },
  beneficiaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderLight,
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
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: 8,
    height: 38,
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
    minWidth: 70,
    textAlign: 'right',
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  optionalCard: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  cardDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  optIcon: {
    marginRight: 10,
  },
  optInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.textPrimary,
    paddingVertical: 0,
  },
  receiptCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    minHeight: 48,
    ...THEME.shadows.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#0B0F19',
    fontSize: 15,
    fontWeight: '700',
  },
});

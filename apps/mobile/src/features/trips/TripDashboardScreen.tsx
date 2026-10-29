import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { LocalDatabase } from '../../storage/db';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { ExpenseRow } from '../../components/ExpenseRow';
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { formatDate } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/media';
import { THEME } from '../../theme';

interface TripDashboardScreenProps {
  route: any;
  navigation: any;
  user: any;
}

type LedgerFilter = 'LEDGER' | 'EXPENSES' | 'PAYMENTS';

export const TripDashboardScreen: React.FC<TripDashboardScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId } = route.params;

  // Initialize immediately from persistent cache for 0ms initial render
  const initialCachedTrip = useMemo(() => LocalDatabase.getTripDetail(tripId), [tripId]);
  const initialCachedExpenses = useMemo(() => LocalDatabase.getExpenses(tripId), [tripId]);
  const initialCachedPayments = useMemo(() => LocalDatabase.getPayments(tripId), [tripId]);
  const initialCachedSettlement = useMemo(() => LocalDatabase.getSettlementPlan(tripId), [tripId]);

  const [trip, setTrip] = useState<any>(initialCachedTrip);
  const [expenses, setExpenses] = useState<any[]>(initialCachedExpenses);
  const [payments, setPayments] = useState<any[]>(initialCachedPayments);
  const [settlement, setSettlement] = useState<any>(initialCachedSettlement);
  const [loading, setLoading] = useState(!initialCachedTrip);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionErrors, setSectionErrors] = useState({ expenses: false, payments: false, settlement: false });
  const [activeTab, setActiveTab] = useState<LedgerFilter>('LEDGER');
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  const lastFetchTimeRef = React.useRef(0);
  const activeFetchPromiseRef = React.useRef<Promise<void> | null>(null);

  const loadTripData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 15000 && trip) {
      return;
    }

    if (activeFetchPromiseRef.current) {
      return activeFetchPromiseRef.current;
    }

    activeFetchPromiseRef.current = (async () => {
      try {
        const [tripResult, expensesResult, paymentsResult, settlementResult] = await Promise.allSettled([
          apiRequest(`/trips/${tripId}`),
          apiRequest(`/trips/${tripId}/expenses`),
          apiRequest(`/trips/${tripId}/payments`),
          apiRequest(`/trips/${tripId}/settlement`),
        ]);

        lastFetchTimeRef.current = Date.now();

        if (tripResult.status === 'fulfilled') {
          setTrip(tripResult.value);
          LocalDatabase.saveTripDetail(tripId, tripResult.value);
        } else if (!trip) {
          const cachedTrip = LocalDatabase.getTripDetail(tripId);
          if (cachedTrip) setTrip(cachedTrip);
        }

        if (expensesResult.status === 'fulfilled') {
          const data = Array.isArray(expensesResult.value) ? expensesResult.value : [];
          setExpenses(data);
          LocalDatabase.saveExpenses(tripId, data);
          setSectionErrors((prev) => ({ ...prev, expenses: false }));
        } else {
          setSectionErrors((prev) => ({ ...prev, expenses: true }));
        }

        if (paymentsResult.status === 'fulfilled') {
          const data = Array.isArray(paymentsResult.value) ? paymentsResult.value : [];
          setPayments(data);
          LocalDatabase.savePayments(tripId, data);
          setSectionErrors((prev) => ({ ...prev, payments: false }));
        } else {
          setSectionErrors((prev) => ({ ...prev, payments: true }));
        }

        if (settlementResult.status === 'fulfilled') {
          setSettlement(settlementResult.value);
          if (settlementResult.value) {
            LocalDatabase.saveSettlementPlan(tripId, settlementResult.value);
          }
          setSectionErrors((prev) => ({ ...prev, settlement: false }));
        } else {
          setSectionErrors((prev) => ({ ...prev, settlement: true }));
        }
      } catch {
        const cachedTrip = LocalDatabase.getTripDetail(tripId);
        const cachedExpenses = LocalDatabase.getExpenses(tripId);
        const cachedPayments = LocalDatabase.getPayments(tripId);
        const cachedSettlement = LocalDatabase.getSettlementPlan(tripId);

        if (cachedTrip && !trip) setTrip(cachedTrip);
        if (cachedExpenses.length > 0 && expenses.length === 0) setExpenses(cachedExpenses);
        if (cachedPayments.length > 0 && payments.length === 0) setPayments(cachedPayments);
        if (cachedSettlement && !settlement) setSettlement(cachedSettlement);
      } finally {
        setLoading(false);
        setRefreshing(false);
        activeFetchPromiseRef.current = null;
      }
    })();

    return activeFetchPromiseRef.current;
  }, [tripId, trip]);

  useEffect(() => {
    loadTripData(false);
    const unsubscribe = navigation.addListener('focus', () => {
      loadTripData(false);
    });
    return unsubscribe;
  }, [navigation, loadTripData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTripData(true);
  };

  // Unified chronological ledger entries with pre-computed timestamps
  const unifiedLedger = useMemo(() => {
    type LedgerItem = {
      id: string;
      itemType: 'EXPENSE' | 'PAYMENT';
      timestamp: number;
      date: string;
      title: string;
      subtitle: string;
      amountPaise: number;
      payerName: string;
      payerAvatar?: string | null;
      beneficiarySummary?: string;
      paymentStatus?: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
      receiptUrl?: string | null;
      raw: any;
    };

    const items: LedgerItem[] = [];

    for (const exp of expenses) {
      const splitCount = exp.allocations?.length || exp.splits?.length || 0;
      const payerName = exp.payerMember?.displayName || exp.payerMember?.user?.name || 'Someone';
      const rawDate = exp.expenseDate || exp.date || exp.createdAt;
      items.push({
        id: `exp-${exp.id}`,
        itemType: 'EXPENSE',
        timestamp: Date.parse(rawDate) || 0,
        date: rawDate,
        title: exp.description,
        subtitle: `${exp.category?.name || 'General'} • Paid by ${payerName}`,
        amountPaise: exp.amountPaise,
        payerName,
        payerAvatar: exp.payerMember?.user?.avatarUrl,
        beneficiarySummary: `Split across ${splitCount} member${splitCount === 1 ? '' : 's'}`,
        receiptUrl: exp.receiptUrl,
        raw: exp,
      });
    }

    for (const p of payments) {
      const payerName = p.payerMember?.displayName || p.payerMember?.user?.name || 'Someone';
      const receiverName = p.receiverMember?.displayName || p.receiverMember?.user?.name || 'Someone';
      const rawDate = p.createdAt;
      items.push({
        id: `pmt-${p.id}`,
        itemType: 'PAYMENT',
        timestamp: Date.parse(rawDate) || 0,
        date: rawDate,
        title: `Payment: ${payerName} → ${receiverName}`,
        subtitle: `${p.paymentMethod || 'UPI'} • ${p.status}`,
        amountPaise: p.amountPaise,
        payerName,
        payerAvatar: p.payerMember?.user?.avatarUrl,
        beneficiarySummary: `To: ${receiverName}`,
        paymentStatus: p.status,
        receiptUrl: p.receiptUrl,
        raw: p,
      });
    }

    // Sort descending by pre-parsed numeric timestamp
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [expenses, payments]);

  if (loading && !refreshing) {
    return <LoadingIndicator message="Loading trip ledger..." />;
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <EmptyState title="Trip Not Found" message="Could not load trip details." />
      </SafeAreaView>
    );
  }

  // Exact paise balance calculations directly from backend
  const userNetBalancePaise = trip.userNetBalancePaise ?? 0;
  const isNetOwed = userNetBalancePaise > 0;
  const isNetOwing = userNetBalancePaise < 0;
  const isSettled = userNetBalancePaise === 0;

  // Bilateral totals
  const obligations = settlement?.bilateralObligations || [];
  let totalYouAreOwed = 0;
  let totalYouOwe = 0;
  for (const ob of obligations) {
    if (ob.amountPaise > 0) {
      totalYouAreOwed += ob.amountPaise;
    } else if (ob.amountPaise < 0) {
      totalYouOwe += Math.abs(ob.amountPaise);
    }
  }

  const isTripClosed = trip.status === 'CLOSED';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />

      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.navTitle} numberOfLines={1}>
          {trip.name}
        </Text>

        <View style={styles.navRightActions}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation.navigate('ExportReport', { tripId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Export Report"
          >
            <Ionicons name="download-outline" size={22} color={THEME.colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation.navigate('TripSettings', { tripId })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trip Cover Banner */}
        {resolveMediaUrl(trip.coverImageUrl) ? (
          <View style={styles.coverBannerContainer}>
            <Image
              source={{ uri: resolveMediaUrl(trip.coverImageUrl)! }}
              style={styles.coverBannerImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Trip Title & Metadata */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text style={styles.tripTitle}>{trip.name}</Text>
            {isTripClosed ? (
              <View style={styles.closedPill}>
                <Ionicons name="lock-closed" size={12} color="#64748B" style={{ marginRight: 3 }} />
                <Text style={styles.closedPillText}>Closed</Text>
              </View>
            ) : (
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>Active</Text>
              </View>
            )}
          </View>

          <View style={styles.metaInfoRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.metaText}>
                {formatDate(trip.startDate)}
                {trip.endDate ? ` – ${formatDate(trip.endDate)}` : ''}
              </Text>
            </View>

            {trip.destination ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color={THEME.colors.textSecondary} />
                <Text style={styles.metaText}>{trip.destination}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Non-blocking sync warning banner */}
        {sectionErrors.expenses || sectionErrors.payments || sectionErrors.settlement ? (
          <TouchableOpacity
            style={styles.syncWarningBanner}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.syncWarningText}>
              Showing cached ledger data. Tap to retry sync.
            </Text>
            <Ionicons name="refresh" size={14} color="#F59E0B" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ) : null}

        {/* YOUR TRIP BALANCE HERO SECTION */}
        <View style={styles.balanceHeroCard}>
          <View style={styles.balanceHeroTop}>
            <Text style={styles.balanceHeroLabel}>YOUR TRIP BALANCE</Text>
            <View
              style={[
                styles.balanceStatusBadge,
                isNetOwed && styles.balanceBadgeCredit,
                isNetOwing && styles.balanceBadgeDebt,
                isSettled && styles.balanceBadgeSettled,
              ]}
            >
              <Ionicons
                name={isNetOwed ? 'arrow-down' : isNetOwing ? 'arrow-up' : 'checkmark'}
                size={12}
                color={isNetOwed ? THEME.colors.credit : isNetOwing ? THEME.colors.debt : THEME.colors.textMuted}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.balanceBadgeText,
                  isNetOwed && { color: THEME.colors.credit },
                  isNetOwing && { color: THEME.colors.debt },
                ]}
              >
                {isNetOwed ? 'Net Creditor' : isNetOwing ? 'Net Debtor' : 'All Settled'}
              </Text>
            </View>
          </View>

          <View style={styles.balanceHeroAmountRow}>
            <AmountText
              paise={userNetBalancePaise}
              size="large"
              colorType={isNetOwed ? 'credit' : isNetOwing ? 'debt' : 'neutral'}
            />
            <Text style={styles.balanceHeroSub}>
              {isNetOwed
                ? 'You are owed in total for this trip'
                : isNetOwing
                ? 'You owe in total for this trip'
                : 'Your balance is exactly settled'}
            </Text>
          </View>

          {/* Bilateral Breakdown Row */}
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>YOU ARE OWED</Text>
              <Text style={[styles.breakdownValue, { color: THEME.colors.credit }]}>
                ₹{(totalYouAreOwed / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>YOU OWE</Text>
              <Text style={[styles.breakdownValue, { color: THEME.colors.debt }]}>
                ₹{(totalYouOwe / 100).toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>TOTAL SPENT</Text>
              <Text style={styles.breakdownValue}>
                ₹{((trip.totalSpentPaise || 0) / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary Action Buttons: Add Expense / Record Payment */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.expenseBtn]}
            onPress={() => navigation.navigate('AddExpense', { tripId })}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.paymentBtn]}
            onPress={() => navigation.navigate('AddPayment', { tripId })}
            activeOpacity={0.85}
          >
            <Ionicons name="paper-plane" size={18} color={THEME.colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.actionBtnText, { color: THEME.colors.primary }]}>
              Record Payment
            </Text>
          </TouchableOpacity>
        </View>

        {/* Shortcuts Bar: Settlement Plan & Export Report */}
        <View style={styles.secondaryActionsRow}>
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => navigation.navigate('SettlementDashboard', { tripId })}
            activeOpacity={0.85}
          >
            <View style={styles.shortcutIconBox}>
              <Ionicons name="git-network-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.shortcutTextCol}>
              <Text style={styles.shortcutTitle}>Settlement Plan</Text>
              <Text style={styles.shortcutSubtitle}>Simplified greedy transactions</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => navigation.navigate('ExportReport', { tripId })}
            activeOpacity={0.85}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.shortcutTextCol}>
              <Text style={styles.shortcutTitle}>Export Report</Text>
              <Text style={styles.shortcutSubtitle}>Official PDF / XLSX audit sheet</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Members Strip */}
        <View style={styles.membersStrip}>
          <View style={styles.membersHeader}>
            <Text style={styles.sectionHeaderTitle}>TRIP MEMBERS ({trip.members?.length || 0})</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TripMembers', { tripId })}>
              <Text style={styles.viewAllText}>Manage</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.avatarRow}
          >
            <TouchableOpacity
              style={styles.inviteMemberBtn}
              onPress={() => navigation.navigate('TripMembers', { tripId })}
            >
              <View style={styles.inviteIconCircle}>
                <Ionicons name="person-add" size={18} color={THEME.colors.primary} />
              </View>
              <Text style={styles.avatarName}>Invite</Text>
            </TouchableOpacity>

            {trip.members?.map((m: any) => {
              const memberName = m.displayName || m.user?.name || 'Member';
              return (
                <TouchableOpacity
                  key={m.id}
                  style={styles.avatarItem}
                  onPress={() => navigation.navigate('MemberProfile', { tripId, memberId: m.id })}
                >
                  <MemberAvatar name={memberName} avatarUrl={m.user?.avatarUrl} size={44} />
                  <Text style={styles.avatarName} numberOfLines={1}>
                    {m.userId === user?.id ? 'You' : memberName.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* COMPLETE CONSOLIDATED LEDGER SECTION */}
        <View style={styles.ledgerSection}>
          <View style={styles.ledgerHeader}>
            <Text style={styles.sectionHeaderTitle}>COMPLETE FINANCIAL LEDGER</Text>
            <Text style={styles.ledgerCountText}>
              {unifiedLedger.length} transaction{unifiedLedger.length === 1 ? '' : 's'}
            </Text>
          </View>

          {/* Segmented Filter Control */}
          <View style={styles.tabContainer}>
            <SegmentedControl
              options={[
                { id: 'LEDGER', label: 'All', count: unifiedLedger.length },
                { id: 'EXPENSES', label: 'Expenses', count: expenses.length },
                { id: 'PAYMENTS', label: 'Payments', count: payments.length },
              ]}
              selectedId={activeTab}
              onSelect={(id) => setActiveTab(id as LedgerFilter)}
            />
          </View>

          {/* Ledger Content List */}
          {activeTab === 'LEDGER' && (
            <View style={styles.entriesList}>
              {unifiedLedger.length === 0 ? (
                <EmptyState
                  title="No Transactions Recorded"
                  message="Use the buttons above to add the first expense or record a settlement payment."
                />
              ) : (
                unifiedLedger.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.ledgerCard}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (item.itemType === 'EXPENSE') {
                        navigation.navigate('ExpenseDetail', { tripId, expenseId: item.raw.id });
                      } else {
                        navigation.navigate('PaymentDetail', { tripId, paymentId: item.raw.id });
                      }
                    }}
                  >
                    <View style={styles.ledgerCardLeft}>
                      <View
                        style={[
                          styles.ledgerIconCircle,
                          item.itemType === 'EXPENSE'
                            ? styles.expenseIconBg
                            : styles.paymentIconBg,
                        ]}
                      >
                        <Ionicons
                          name={item.itemType === 'EXPENSE' ? 'receipt-outline' : 'paper-plane-outline'}
                          size={18}
                          color={item.itemType === 'EXPENSE' ? THEME.colors.primary : '#8B5CF6'}
                        />
                      </View>

                      <View style={styles.ledgerInfo}>
                        <Text style={styles.ledgerTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.ledgerSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                        <View style={styles.beneficiaryRow}>
                          <Ionicons name="people" size={11} color={THEME.colors.textMuted} />
                          <Text style={styles.beneficiaryText}>{item.beneficiarySummary}</Text>
                          <Text style={styles.dateSeparator}>•</Text>
                          <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.ledgerCardRight}>
                      <AmountText
                        paise={item.amountPaise}
                        size="medium"
                        colorType={item.itemType === 'EXPENSE' ? 'neutral' : 'credit'}
                      />

                      <View style={styles.badgeRow}>
                        {item.paymentStatus ? (
                          <PaymentStatusBadge status={item.paymentStatus} size="small" />
                        ) : null}

                        {item.receiptUrl ? (
                          <TouchableOpacity
                            onPress={() => setPreviewReceiptUrl(item.receiptUrl!)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="image-outline" size={16} color={THEME.colors.primary} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {activeTab === 'EXPENSES' && (
            <View style={styles.entriesList}>
              {expenses.length === 0 ? (
                <EmptyState
                  title="No Expenses Recorded"
                  message="Tap '+ Add Expense' to record shared purchases."
                />
              ) : (
                expenses.map((exp) => (
                  <ExpenseRow
                    key={exp.id}
                    expense={exp}
                    currentUserId={user?.id}
                    onPress={() => navigation.navigate('ExpenseDetail', { tripId, expenseId: exp.id })}
                  />
                ))
              )}
            </View>
          )}

          {activeTab === 'PAYMENTS' && (
            <View style={styles.entriesList}>
              {payments.length === 0 ? (
                <EmptyState
                  title="No Payments Recorded"
                  message="Tap 'Record Payment' when a debt settlement transaction occurs."
                />
              ) : (
                payments.map((p) => {
                  const payerName = p.payerMember?.user?.name || 'Someone';
                  const receiverName = p.receiverMember?.user?.name || 'Someone';
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.ledgerCard}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('PaymentDetail', { tripId, paymentId: p.id })}
                    >
                      <View style={styles.ledgerCardLeft}>
                        <View style={[styles.ledgerIconCircle, styles.paymentIconBg]}>
                          <Ionicons name="paper-plane-outline" size={18} color="#8B5CF6" />
                        </View>
                        <View style={styles.ledgerInfo}>
                          <Text style={styles.ledgerTitle}>
                            {payerName} → {receiverName}
                          </Text>
                          <Text style={styles.ledgerSubtitle}>
                            Method: {p.paymentMethod || 'UPI'}
                          </Text>
                          <Text style={styles.dateText}>{formatDate(p.createdAt)}</Text>
                        </View>
                      </View>

                      <View style={styles.ledgerCardRight}>
                        <AmountText paise={p.amountPaise} size="medium" colorType="neutral" />
                        <View style={{ marginTop: 4 }}>
                          <PaymentStatusBadge status={p.status} size="small" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fullscreen Receipt Preview Modal */}
      <Modal
        visible={!!previewReceiptUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewReceiptUrl(null)}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalCard}>
            <View style={styles.receiptModalHeader}>
              <Text style={styles.receiptModalTitle}>Receipt Attachment</Text>
              <TouchableOpacity onPress={() => setPreviewReceiptUrl(null)}>
                <Ionicons name="close-circle" size={26} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {resolveMediaUrl(previewReceiptUrl) ? (
              <Image
                source={{ uri: resolveMediaUrl(previewReceiptUrl)! }}
                style={styles.receiptImage}
                resizeMode="contain"
              />
            ) : null}
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
  scrollContent: {
    paddingBottom: THEME.spacing.xxl,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
    backgroundColor: THEME.colors.card,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navTitle: {
    ...THEME.typography.h3,
    fontSize: 17,
    maxWidth: '55%',
  },
  coverBannerContainer: {
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.xs,
    borderRadius: THEME.borderRadius.lg,
    overflow: 'hidden',
    height: 140,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  coverBannerImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripTitle: {
    ...THEME.typography.h1,
    fontSize: 22,
    color: THEME.colors.textPrimary,
  },
  tabContainer: {
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  closedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  closedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.confirmedBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.confirmedBorder,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.emerald,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.emerald,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...THEME.typography.bodySmall,
    fontSize: 13,
  },
  balanceHeroCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.xl,
    marginHorizontal: THEME.spacing.md,
    marginVertical: THEME.spacing.sm,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    ...THEME.shadows.md,
  },
  balanceHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  balanceStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
  },
  balanceBadgeCredit: {
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
  },
  balanceBadgeDebt: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  balanceBadgeSettled: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  balanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceHeroAmountRow: {
    marginBottom: 16,
  },
  balanceHeroSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
  breakdownCol: {
    alignItems: 'center',
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  breakdownDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.md,
    gap: 12,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseBtn: {
    backgroundColor: THEME.colors.primary,
    ...THEME.shadows.sm,
  },
  paymentBtn: {
    backgroundColor: THEME.colors.card,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionsRow: {
    paddingHorizontal: THEME.spacing.md,
    gap: 8,
    marginVertical: THEME.spacing.xs,
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    padding: 12,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  shortcutIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shortcutTextCol: {
    flex: 1,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  shortcutSubtitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  membersStrip: {
    marginTop: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  avatarRow: {
    paddingHorizontal: THEME.spacing.md,
    gap: 12,
  },
  inviteMemberBtn: {
    alignItems: 'center',
    width: 52,
  },
  inviteIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarItem: {
    alignItems: 'center',
    width: 52,
  },
  avatarName: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  ledgerSection: {
    marginTop: THEME.spacing.xs,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.xs,
  },
  ledgerCountText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginHorizontal: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    padding: 3,
    marginBottom: THEME.spacing.sm,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: THEME.borderRadius.sm,
  },
  activeTabItem: {
    backgroundColor: THEME.colors.card,
    ...THEME.shadows.sm,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  activeTabText: {
    color: THEME.colors.mint,
    fontWeight: '700',
  },
  entriesList: {
    paddingHorizontal: THEME.spacing.md,
  },
  ledgerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  ledgerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  ledgerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseIconBg: {
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
  },
  paymentIconBg: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  ledgerInfo: {
    flex: 1,
  },
  ledgerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  ledgerSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  beneficiaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  beneficiaryText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  dateSeparator: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  dateText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  ledgerCardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: '#1E293B',
  },
  statusBadgeConfirmed: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusBadgeDisputed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statusBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
  },
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  receiptModalCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.md,
    width: '100%',
    maxHeight: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  receiptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  receiptModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  receiptImage: {
    width: '100%',
    height: 400,
    borderRadius: THEME.borderRadius.md,
  },
  syncWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  syncWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
});

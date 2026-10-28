import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { LocalDatabase } from '../../storage/db';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { ExpenseRow } from '../../components/ExpenseRow';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { THEME } from '../../theme';

interface TripDashboardScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const TripDashboardScreen: React.FC<TripDashboardScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXPENSES'>('OVERVIEW');

  const loadTripData = useCallback(async () => {
    try {
      const [tripData, expensesData] = await Promise.all([
        apiRequest(`/trips/${tripId}`),
        apiRequest(`/trips/${tripId}/expenses`),
      ]);
      setTrip(tripData);
      setExpenses(expensesData || []);

      LocalDatabase.saveTripDetail(tripId, tripData);
      LocalDatabase.saveExpenses(tripId, expensesData || []);
    } catch {
      const cachedTrip = LocalDatabase.getTripDetail(tripId);
      const cachedExpenses = LocalDatabase.getExpenses(tripId);
      if (cachedTrip) setTrip(cachedTrip);
      if (cachedExpenses) setExpenses(cachedExpenses);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadTripData();
    const unsubscribe = navigation.addListener('focus', loadTripData);
    return unsubscribe;
  }, [navigation, loadTripData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTripData();
  };

  if (loading && !refreshing) {
    return <LoadingIndicator message="Loading trip..." />;
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState title="Trip Not Found" message="Could not load trip details." />
      </SafeAreaView>
    );
  }

  const userBalance = trip.userNetBalancePaise || 0;
  const youAreOwed = userBalance > 0 ? userBalance : 0;
  const youOwe = userBalance < 0 ? Math.abs(userBalance) : 0;
  const isTripClosed = trip.status === 'CLOSED';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

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

        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => navigation.navigate('TripSettings', { tripId })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trip Title & Metadata */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text style={styles.tripTitle}>{trip.name}</Text>
            {isTripClosed ? (
              <View style={styles.closedPill}>
                <Ionicons name="lock-closed" size={12} color="#64748B" style={{ marginRight: 3 }} />
                <Text style={styles.closedPillText}>Closed</Text>
              </View>
            ) : null}
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

        {/* Balance Cards: You Are Owed / You Owe */}
        <View style={styles.balanceCardsRow}>
          <View style={[styles.balanceCard, youAreOwed > 0 && styles.activeCreditCard]}>
            <View style={styles.balanceCardHeader}>
              <Text style={styles.balanceCardLabel}>YOU ARE OWED</Text>
              <Ionicons
                name="arrow-down-circle"
                size={16}
                color={youAreOwed > 0 ? THEME.colors.credit : THEME.colors.textMuted}
              />
            </View>
            <AmountText
              paise={youAreOwed}
              size="large"
              colorType={youAreOwed > 0 ? 'credit' : 'neutral'}
            />
          </View>

          <View style={[styles.balanceCard, youOwe > 0 && styles.activeDebtCard]}>
            <View style={styles.balanceCardHeader}>
              <Text style={styles.balanceCardLabel}>YOU OWE</Text>
              <Ionicons
                name="arrow-up-circle"
                size={16}
                color={youOwe > 0 ? THEME.colors.debt : THEME.colors.textMuted}
              />
            </View>
            <AmountText
              paise={-youOwe}
              size="large"
              colorType={youOwe > 0 ? 'debt' : 'neutral'}
            />
          </View>
        </View>

        {/* Action Buttons: Add Expense / Add Payment */}
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

        {/* Settlement Hub Banner */}
        <TouchableOpacity
          style={styles.settlementBanner}
          onPress={() => navigation.navigate('SettlementDashboard', { tripId })}
          activeOpacity={0.85}
        >
          <View style={styles.settlementBannerLeft}>
            <View style={styles.settlementIconBox}>
              <Ionicons name="git-network-outline" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.settlementTitle}>Settlement Plan</Text>
              <Text style={styles.settlementSub}>Smart greedy debt simplification</Text>
            </View>
          </View>
          <View style={styles.settlementArrow}>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Members Strip */}
        <View style={styles.membersStrip}>
          <View style={styles.membersHeader}>
            <Text style={styles.sectionHeaderTitle}>MEMBERS ({trip.members?.length || 0})</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TripMembers', { tripId })}>
              <Text style={styles.viewAllText}>Manage</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.avatarRow}
          >
            {/* Quick Invite Button */}
            <TouchableOpacity
              style={styles.inviteMemberBtn}
              onPress={() => navigation.navigate('TripMembers', { tripId })}
            >
              <View style={styles.inviteIconCircle}>
                <Ionicons name="person-add" size={18} color={THEME.colors.primary} />
              </View>
              <Text style={styles.avatarName}>Invite</Text>
            </TouchableOpacity>

            {trip.members?.map((m: any) => (
              <TouchableOpacity
                key={m.id}
                style={styles.avatarItem}
                onPress={() => navigation.navigate('MemberProfile', { tripId, memberId: m.id })}
              >
                <MemberAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={44} />
                <Text style={styles.avatarName} numberOfLines={1}>
                  {m.userId === user?.id ? 'You' : m.user.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Segmented Tab Control */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'OVERVIEW' && styles.activeTabItem]}
            onPress={() => setActiveTab('OVERVIEW')}
          >
            <Text style={[styles.tabText, activeTab === 'OVERVIEW' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'EXPENSES' && styles.activeTabItem]}
            onPress={() => setActiveTab('EXPENSES')}
          >
            <Text style={[styles.tabText, activeTab === 'EXPENSES' && styles.activeTabText]}>
              All Expenses ({expenses.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'OVERVIEW' ? (
          <View style={styles.overviewSection}>
            <View style={styles.recentActivityHeader}>
              <Text style={styles.sectionHeaderTitle}>RECENT EXPENSES</Text>
              {expenses.length > 5 ? (
                <TouchableOpacity onPress={() => setActiveTab('EXPENSES')}>
                  <Text style={styles.viewAllText}>See all ({expenses.length})</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {expenses.length === 0 ? (
              <EmptyState
                title="No Expenses Yet"
                message="Tap '+ Add Expense' above to record the first transaction for this trip."
              />
            ) : (
              expenses.slice(0, 5).map((exp) => (
                <ExpenseRow
                  key={exp.id}
                  expense={exp}
                  currentUserId={user?.id}
                  onPress={() => navigation.navigate('ExpenseDetail', { tripId, expenseId: exp.id })}
                />
              ))
            )}
          </View>
        ) : (
          <View style={styles.expensesListSection}>
            {expenses.length === 0 ? (
              <EmptyState
                title="No Expenses Yet"
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
      </ScrollView>
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
  navTitle: {
    ...THEME.typography.h3,
    fontSize: 17,
    maxWidth: '65%',
  },
  titleSection: {
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripTitle: {
    ...THEME.typography.h1,
    fontSize: 24,
    color: THEME.colors.textPrimary,
  },
  closedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
  },
  closedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
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
  balanceCardsRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.md,
    gap: 12,
    marginVertical: THEME.spacing.sm,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  activeCreditCard: {
    borderColor: THEME.colors.creditBorder,
    backgroundColor: THEME.colors.creditBg,
  },
  activeDebtCard: {
    borderColor: THEME.colors.debtBorder,
    backgroundColor: THEME.colors.debtBg,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.md,
    gap: 12,
    marginVertical: THEME.spacing.sm,
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
  settlementBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.darkCanvas,
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.lg,
    ...THEME.shadows.sm,
  },
  settlementBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settlementIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settlementSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  settlementArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersStrip: {
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.6,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 2,
  },
  avatarItem: {
    alignItems: 'center',
    width: 52,
  },
  avatarName: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
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
    backgroundColor: THEME.colors.primaryLight,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardAlt,
    marginHorizontal: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    padding: 3,
    marginBottom: THEME.spacing.sm,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.borderRadius.sm,
  },
  activeTabItem: {
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  activeTabText: {
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  overviewSection: {
    paddingTop: THEME.spacing.xs,
  },
  recentActivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.xs,
  },
  expensesListSection: {
    paddingTop: THEME.spacing.xs,
  },
});

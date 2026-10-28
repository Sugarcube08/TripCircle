import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
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
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXPENSES' | 'SETTLEMENT'>('OVERVIEW');

  const loadTripData = useCallback(async () => {
    try {
      const [tripData, expensesData] = await Promise.all([
        apiRequest(`/trips/${tripId}`),
        apiRequest(`/trips/${tripId}/expenses`),
      ]);
      setTrip(tripData);
      setExpenses(expensesData || []);

      // Cache locally
      LocalDatabase.saveTripDetail(tripId, tripData);
      LocalDatabase.saveExpenses(tripId, expensesData || []);
    } catch {
      // Fallback to cache
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
      <View style={styles.container}>
        <EmptyState title="Trip Not Found" message="Could not load trip details." />
      </View>
    );
  }

  const userBalance = trip.userNetBalancePaise || 0;
  const youAreOwed = userBalance > 0 ? userBalance : 0;
  const youOwe = userBalance < 0 ? Math.abs(userBalance) : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Trips</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('TripSettings', { tripId })}
        >
          <Text style={styles.settingsText}>Settings •••</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Trip Title & Info */}
        <View style={styles.titleSection}>
          <Text style={styles.tripTitle}>{trip.name.toUpperCase()}</Text>
          <Text style={styles.tripSubtitle}>
            {formatDate(trip.startDate)}
            {trip.endDate ? ` – ${formatDate(trip.endDate)}` : ''} · {trip.members.length} members
          </Text>
        </View>

        {/* Balance Cards: You are owed / You owe */}
        <View style={styles.balanceCardsRow}>
          <View style={[styles.balanceCard, youAreOwed > 0 && styles.activeCreditCard]}>
            <Text style={styles.balanceCardLabel}>YOU ARE OWED</Text>
            <AmountText paise={youAreOwed} size="large" colorType={youAreOwed > 0 ? 'credit' : 'neutral'} />
          </View>
          <View style={[styles.balanceCard, youOwe > 0 && styles.activeDebtCard]}>
            <Text style={styles.balanceCardLabel}>YOU OWE</Text>
            <AmountText paise={-youOwe} size="large" colorType={youOwe > 0 ? 'debt' : 'neutral'} />
          </View>
        </View>

        {/* Action Buttons: Add Expense & Add Payment */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.expenseBtn]}
            onPress={() => navigation.navigate('AddExpense', { tripId })}
          >
            <Text style={styles.actionBtnText}>+ Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.paymentBtn]}
            onPress={() => navigation.navigate('AddPayment', { tripId })}
          >
            <Text style={[styles.actionBtnText, { color: THEME.colors.primary }]}>
              + Add Payment
            </Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'OVERVIEW' && styles.activeTabItem]}
            onPress={() => setActiveTab('OVERVIEW')}
          >
            <Text style={[styles.tabText, activeTab === 'OVERVIEW' && styles.activeTabText]}>
              OVERVIEW
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'EXPENSES' && styles.activeTabItem]}
            onPress={() => setActiveTab('EXPENSES')}
          >
            <Text style={[styles.tabText, activeTab === 'EXPENSES' && styles.activeTabText]}>
              EXPENSES ({expenses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'SETTLEMENT' && styles.activeTabItem]}
            onPress={() => navigation.navigate('SettlementDashboard', { tripId })}
          >
            <Text style={styles.tabText}>SETTLEMENT ➔</Text>
          </TouchableOpacity>
        </View>

        {/* Members Quick Strip */}
        <View style={styles.membersStrip}>
          <View style={styles.membersHeader}>
            <Text style={styles.sectionHeaderTitle}>MEMBERS ({trip.members.length})</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TripMembers', { tripId })}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow}>
            {trip.members.map((m: any) => (
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

        {/* Content according to tab */}
        {activeTab === 'OVERVIEW' ? (
          <View style={styles.overviewSection}>
            <View style={styles.recentActivityHeader}>
              <Text style={styles.sectionHeaderTitle}>RECENT EXPENSES</Text>
              <TouchableOpacity onPress={() => setActiveTab('EXPENSES')}>
                <Text style={styles.viewAllText}>See all ({expenses.length})</Text>
              </TouchableOpacity>
            </View>

            {expenses.slice(0, 5).map((exp) => (
              <ExpenseRow
                key={exp.id}
                expense={exp}
                currentUserId={user?.id}
                onPress={() => navigation.navigate('ExpenseDetail', { tripId, expenseId: exp.id })}
              />
            ))}

            {expenses.length === 0 ? (
              <EmptyState title="No Expenses Yet" message="Tap '+ Add Expense' to record the first trip expense." />
            ) : null}
          </View>
        ) : (
          <View style={styles.expensesList}>
            {expenses.map((exp) => (
              <ExpenseRow
                key={exp.id}
                expense={exp}
                currentUserId={user?.id}
                onPress={() => navigation.navigate('ExpenseDetail', { tripId, expenseId: exp.id })}
              />
            ))}
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
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  settingsBtn: {
    paddingVertical: 4,
  },
  settingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: THEME.spacing.xxl,
  },
  titleSection: {
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
  },
  tripTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
  },
  tripSubtitle: {
    ...THEME.typography.bodySmall,
    marginTop: 2,
  },
  balanceCardsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: THEME.spacing.md,
    marginVertical: THEME.spacing.md,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  activeCreditCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  activeDebtCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  balanceCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseBtn: {
    backgroundColor: THEME.colors.primary,
  },
  paymentBtn: {
    backgroundColor: THEME.colors.card,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: THEME.spacing.md,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: THEME.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: THEME.colors.primary,
  },
  membersStrip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 16,
  },
  avatarItem: {
    alignItems: 'center',
    width: 54,
  },
  avatarName: {
    fontSize: 11,
    color: THEME.colors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
  },
  overviewSection: {
    marginTop: 4,
  },
  recentActivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
  },
  expensesList: {
    marginTop: 4,
  },
});

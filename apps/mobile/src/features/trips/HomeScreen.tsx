import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TripSummary } from '@tripcircle/contracts';
import { apiRequest } from '../../services/api';
import { performSync } from '../../services/sync';
import { LocalDatabase } from '../../storage/db';
import { TripCard } from '../../components/TripCard';
import { AmountText } from '../../components/AmountText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { OfflineBanner } from '../../components/OfflineBanner';
import { EmptyState } from '../../components/EmptyState';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { THEME } from '../../theme';

interface HomeScreenProps {
  navigation: any;
  user: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, user }) => {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [netPosition, setNetPosition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const syncResult = await performSync();
      setIsOffline(syncResult.isOffline);
      setLastSync(syncResult.lastSyncTimestamp);

      if (!syncResult.isOffline) {
        const data = await apiRequest('/trips');
        setTrips(data.trips || []);
        setNetPosition(data.aggregateNetPosition || null);

        // Check invitations count
        const invites = await apiRequest('/invitations').catch(() => []);
        setPendingInvitesCount(invites.length || 0);
      } else {
        const cachedTrips = LocalDatabase.getTrips();
        setTrips(cachedTrips);
      }
    } catch {
      setIsOffline(true);
      const cachedTrips = LocalDatabase.getTrips();
      setTrips(cachedTrips);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !refreshing) {
    return <LoadingIndicator message="Loading your trips..." />;
  }

  const isNetOwed = (netPosition?.netOwedToUserPaise || 0) > 0;
  const isNetOwing = (netPosition?.netUserOwesPaise || 0) > 0;
  const netPaise = isNetOwed
    ? netPosition.netOwedToUserPaise
    : isNetOwing
    ? -netPosition.netUserOwesPaise
    : 0;

  const renderHeader = () => (
    <View style={styles.header}>
      <OfflineBanner isOffline={isOffline} lastSyncTimestamp={lastSync} />

      {/* Top Bar Branding */}
      <View style={styles.topBar}>
        <View style={styles.brandLockup}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.brandIconSmall}
            resizeMode="contain"
          />
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitleTrip}>Trip</Text>
              <Text style={styles.brandTitleCircle}>Circle</Text>
            </View>
            <Text style={styles.appSub}>Shared Group Ledger</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Main', { screen: 'ProfileTab' })}
          style={styles.avatarButton}
          activeOpacity={0.8}
        >
          <MemberAvatar name={user?.name || 'You'} avatarUrl={user?.avatarUrl} size={40} />
        </TouchableOpacity>
      </View>

      {/* Invitations Notification Banner */}
      {pendingInvitesCount > 0 ? (
        <TouchableOpacity
          style={styles.inviteBanner}
          onPress={() => navigation.navigate('Invitations')}
          activeOpacity={0.85}
        >
          <View style={styles.inviteBannerLeft}>
            <View style={styles.inviteIconCircle}>
              <Ionicons name="mail" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.inviteText}>
              You have {pendingInvitesCount} pending trip invitation{pendingInvitesCount > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.inviteActionBadge}>
            <Text style={styles.inviteAction}>Review</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Net Position Hero Card (Obsidian & Mint Fintech Card) */}
      <View style={styles.netCard}>
        <View style={styles.netCardTop}>
          <Text style={styles.netCardTitle}>OVERALL NET POSITION</Text>
          <View style={styles.netPillBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#00F5A0" style={{ marginRight: 4 }} />
            <Text style={styles.netPillText}>Paise-exact</Text>
          </View>
        </View>

        <View style={styles.netBalanceRow}>
          <Text style={styles.netSubtitle}>
            {isNetOwed
              ? 'You are owed in total'
              : isNetOwing
              ? 'You owe in total'
              : 'All settled up'}
          </Text>
          <AmountText
            paise={netPaise}
            size="large"
            colorType={isNetOwed ? 'credit' : isNetOwing ? 'debt' : 'neutral'}
          />
        </View>

        <View style={styles.netCardFooter}>
          <Text style={styles.netTripsCount}>
            Across {netPosition?.activeTripsCount ?? trips.length} active trip
            {(netPosition?.activeTripsCount ?? trips.length) === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>YOUR TRIPS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{trips.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.newTripBtn, isOffline && styles.newTripBtnDisabled]}
          onPress={() => navigation.navigate('CreateTrip')}
          disabled={isOffline}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.newTripBtnText}>New Trip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => navigation.navigate('TripDashboard', { tripId: item.id })}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            title="No Trips Recorded"
            message="Create your first trip or join friends to start keeping an exact shared ledger."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  listContent: {
    paddingBottom: THEME.spacing.xxl,
  },
  header: {
    paddingBottom: THEME.spacing.xs,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconSmall: {
    width: 38,
    height: 38,
    borderRadius: THEME.borderRadius.sm,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleTrip: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandTitleCircle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: -0.3,
  },
  appSub: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.3,
  },
  avatarButton: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: THEME.colors.borderLight,
    ...THEME.shadows.sm,
  },
  inviteBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    ...THEME.shadows.sm,
  },
  inviteBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  inviteIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  inviteText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  inviteActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
    gap: 2,
  },
  inviteAction: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  netCard: {
    backgroundColor: THEME.colors.darkCanvas,
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...THEME.shadows.md,
  },
  netCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.xs,
  },
  netCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.8,
  },
  netPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 160, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
  },
  netPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00F5A0',
    letterSpacing: 0.2,
  },
  netBalanceRow: {
    marginVertical: THEME.spacing.xs,
  },
  netSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  netCardFooter: {
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  netTripsCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.xs,
    paddingBottom: THEME.spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: THEME.colors.cardAlt,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  newTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
    gap: 4,
    ...THEME.shadows.sm,
  },
  newTripBtnDisabled: {
    opacity: 0.5,
  },
  newTripBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

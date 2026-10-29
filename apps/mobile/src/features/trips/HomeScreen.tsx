import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TripSummary } from '@tripcircle/contracts';
import { apiRequest } from '../../services/api';
import { performSync } from '../../services/sync';
import { LocalDatabase } from '../../storage/db';
import { TripCard } from '../../components/TripCard';
import { MemberAvatar } from '../../components/MemberAvatar';
import { OfflineBanner } from '../../components/OfflineBanner';
import { EmptyState } from '../../components/EmptyState';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { THEME } from '../../theme';

interface HomeScreenProps {
  navigation: any;
  user: any;
}

type FilterStatus = 'ALL' | 'ACTIVE' | 'CLOSED';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, user }) => {
  const initialCachedTrips = useMemo(() => LocalDatabase.getTrips(), []);
  const [trips, setTrips] = useState<TripSummary[]>(initialCachedTrips);
  const [loading, setLoading] = useState(initialCachedTrips.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(LocalDatabase.getCache().lastSyncTimestamp);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('ALL');

  const lastFetchTimeRef = useRef<number>(0);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    // Prevent redundant sync execution if focused recently unless forced via pull-to-refresh
    if (!force && now - lastFetchTimeRef.current < 15000 && trips.length > 0) {
      return;
    }

    try {
      lastFetchTimeRef.current = now;
      const [syncResult, invites] = await Promise.all([
        performSync({ force }),
        apiRequest('/invitations').catch(() => []),
      ]);

      setIsOffline(syncResult.isOffline);
      setLastSync(syncResult.lastSyncTimestamp);
      setPendingInvitesCount(Array.isArray(invites) ? invites.length : 0);

      const latestTrips = syncResult.trips || LocalDatabase.getTrips();
      setTrips(latestTrips);
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !err?.isTimeout) {
        setIsOffline(true);
      }
      setTrips(LocalDatabase.getTrips());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trips.length]);

  useEffect(() => {
    loadData(false);
    const unsubscribe = navigation.addListener('focus', () => {
      loadData(false);
    });
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const filteredTrips = useMemo(() => {
    if (selectedFilter === 'ACTIVE') {
      return trips.filter((t) => t.status !== 'CLOSED');
    }
    if (selectedFilter === 'CLOSED') {
      return trips.filter((t) => t.status === 'CLOSED');
    }
    return trips;
  }, [trips, selectedFilter]);

  const activeCount = useMemo(
    () => trips.filter((t) => t.status !== 'CLOSED').length,
    [trips]
  );
  const closedCount = useMemo(
    () => trips.filter((t) => t.status === 'CLOSED').length,
    [trips]
  );

  if (loading && !refreshing) {
    return <LoadingIndicator message="Loading your trips..." />;
  }

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
            <Text style={styles.appSub}>Shared Group Financial Ledger</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Main', { screen: 'ProfileTab' })}
          style={styles.avatarButton}
          accessibilityRole="button"
          accessibilityLabel="Open user profile"
          activeOpacity={0.8}
        >
          <MemberAvatar name={user?.name || 'You'} avatarUrl={user?.avatarUrl} size={38} />
        </TouchableOpacity>
      </View>

      {/* Invitations Notification Banner */}
      {pendingInvitesCount > 0 ? (
        <TouchableOpacity
          style={styles.inviteBanner}
          onPress={() => navigation.navigate('Invitations')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`You have ${pendingInvitesCount} pending trip invitations`}
        >
          <View style={styles.inviteBannerLeft}>
            <View style={styles.inviteIconCircle}>
              <Ionicons name="mail" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.inviteText}>
              You have {pendingInvitesCount} pending invitation{pendingInvitesCount > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.inviteActionBadge}>
            <Text style={styles.inviteAction}>Review</Text>
            <Ionicons name="chevron-forward" size={12} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Section Header with Primary Create Trip Action */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.directoryTitle}>Trips Directory</Text>
          <Text style={styles.directorySubtitle}>All open and closed trip ledgers</Text>
        </View>

        <TouchableOpacity
          style={[styles.newTripBtn, isOffline && styles.newTripBtnDisabled]}
          onPress={() => navigation.navigate('CreateTrip')}
          disabled={isOffline}
          accessibilityRole="button"
          accessibilityLabel="Create a new trip"
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.newTripBtnText}>Create Trip</Text>
        </TouchableOpacity>
      </View>

      {/* Standardized Filter Segmented Control */}
      <View style={styles.filterContainer}>
        <SegmentedControl
          options={[
            { id: 'ALL', label: 'All', count: trips.length },
            { id: 'ACTIVE', label: 'Active', count: activeCount },
            { id: 'CLOSED', label: 'Closed', count: closedCount, icon: 'lock-closed' },
          ]}
          selectedId={selectedFilter}
          onSelect={(id) => setSelectedFilter(id as FilterStatus)}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      <FlatList
        data={filteredTrips}
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
            title={selectedFilter === 'ALL' ? 'No Trips Recorded' : `No ${selectedFilter.toLowerCase()} trips`}
            message={
              selectedFilter === 'ALL'
                ? 'Create your first trip or join friends to start keeping an exact shared ledger.'
                : `There are currently no ${selectedFilter.toLowerCase()} trips in your directory.`
            }
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
    paddingBottom: THEME.spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.sm,
    paddingBottom: THEME.spacing.sm,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconSmall: {
    width: 34,
    height: 34,
    borderRadius: THEME.borderRadius.sm,
  },
  brandTitleRow: {
    flexDirection: 'row',
  },
  brandTitleTrip: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTitleCircle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '500',
    marginTop: -1,
  },
  avatarButton: {
    width: THEME.dimensions.minTouchTarget,
    height: THEME.dimensions.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.primaryDark,
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inviteBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  inviteIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  inviteActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.sm,
    marginLeft: 8,
  },
  inviteAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  directoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  directorySubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  newTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: THEME.borderRadius.md,
    ...THEME.shadows.sm,
  },
  newTripBtnDisabled: {
    opacity: 0.5,
  },
  newTripBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterContainer: {
    paddingHorizontal: THEME.spacing.md,
    marginTop: 6,
    marginBottom: THEME.spacing.sm,
  },
});

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  const loadData = useCallback(async (force = false) => {
    try {
      // Execute incremental sync and pending invitations concurrently
      const [syncResult, invites] = await Promise.all([
        performSync({ force }),
        apiRequest('/invitations').catch(() => []),
      ]);

      setIsOffline(syncResult.isOffline);
      setLastSync(syncResult.lastSyncTimestamp);
      setPendingInvitesCount(Array.isArray(invites) ? invites.length : 0);

      const latestTrips = syncResult.trips || LocalDatabase.getTrips();
      setTrips(latestTrips);
    } catch {
      setIsOffline(true);
      setTrips(LocalDatabase.getTrips());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.newTripBtnText}>Create Trip</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('ALL')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterChipText, selectedFilter === 'ALL' && styles.filterChipTextActive]}>
            All ({trips.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'ACTIVE' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('ACTIVE')}
          activeOpacity={0.7}
        >
          <View style={styles.activeDotSmall} />
          <Text style={[styles.filterChipText, selectedFilter === 'ACTIVE' && styles.filterChipTextActive]}>
            Active ({activeCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, selectedFilter === 'CLOSED' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('CLOSED')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="lock-closed"
            size={11}
            color={selectedFilter === 'CLOSED' ? '#FFFFFF' : THEME.colors.textSecondary}
            style={{ marginRight: 3 }}
          />
          <Text style={[styles.filterChipText, selectedFilter === 'CLOSED' && styles.filterChipTextActive]}>
            Closed ({closedCount})
          </Text>
        </TouchableOpacity>
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
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 8,
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
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 22,
    ...THEME.shadows.sm,
  },
  inviteBanner: {
    marginHorizontal: THEME.spacing.md,
    marginVertical: THEME.spacing.xs,
    backgroundColor: THEME.colors.darkCanvas,
    borderRadius: THEME.borderRadius.lg,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.sm,
  },
  inviteBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  inviteActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
    gap: 2,
  },
  inviteAction: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.sm,
    paddingBottom: THEME.spacing.xs,
  },
  directoryTitle: {
    ...THEME.typography.h2,
    fontSize: 18,
    color: THEME.colors.textPrimary,
  },
  directorySubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  newTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.full,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.md,
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  activeDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
});

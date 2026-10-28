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
} from 'react-native';
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
        // Load from local SQLite / cache
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

  const renderHeader = () => (
    <View style={styles.header}>
      <OfflineBanner isOffline={isOffline} lastSyncTimestamp={lastSync} />

      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>TripCircle</Text>
          <Text style={styles.appSub}>Your trips, without the confusion</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Main', { screen: 'ProfileTab' })}
        >
          <MemberAvatar name={user?.name || 'You'} avatarUrl={user?.avatarUrl} size={42} />
        </TouchableOpacity>
      </View>

      {/* Invitations Alert Banner */}
      {pendingInvitesCount > 0 ? (
        <TouchableOpacity
          style={styles.inviteBanner}
          onPress={() => navigation.navigate('Invitations')}
        >
          <Text style={styles.inviteText}>
            📩 You have {pendingInvitesCount} pending trip invitation{pendingInvitesCount > 1 ? 's' : ''}!
          </Text>
          <Text style={styles.inviteAction}>View</Text>
        </TouchableOpacity>
      ) : null}

      {/* Net Position Card */}
      <View style={styles.netCard}>
        <Text style={styles.netCardTitle}>YOUR NET POSITION</Text>
        {netPosition?.netOwedToUserPaise > 0 ? (
          <>
            <Text style={styles.netSubtitle}>You are owed</Text>
            <AmountText
              paise={netPosition.netOwedToUserPaise}
              size="large"
              colorType="credit"
            />
          </>
        ) : netPosition?.netUserOwesPaise > 0 ? (
          <>
            <Text style={styles.netSubtitle}>You owe</Text>
            <AmountText
              paise={-netPosition.netUserOwesPaise}
              size="large"
              colorType="debt"
            />
          </>
        ) : (
          <>
            <Text style={styles.netSubtitle}>All settled up</Text>
            <AmountText paise={0} size="large" colorType="neutral" />
          </>
        )}
        <Text style={styles.netTripsCount}>
          Across {netPosition?.activeTripsCount || trips.length} active trips
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>YOUR TRIPS</Text>
        <TouchableOpacity
          style={styles.newTripBtn}
          onPress={() => navigation.navigate('CreateTrip')}
          disabled={isOffline}
        >
          <Text style={[styles.newTripBtnText, isOffline && { opacity: 0.5 }]}>
            + New Trip
          </Text>
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
            title="No Trips Yet"
            message="Create your first trip or join friends to start tracking shared expenses."
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
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  appSub: {
    ...THEME.typography.bodySmall,
  },
  inviteBanner: {
    backgroundColor: '#EFF6FF',
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.sm,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
    flex: 1,
  },
  inviteAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 8,
  },
  netCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    marginHorizontal: THEME.spacing.md,
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  netCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  netSubtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  netTripsCount: {
    ...THEME.typography.caption,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
  },
  newTripBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: THEME.colors.primaryLight,
    borderRadius: THEME.borderRadius.sm,
  },
  newTripBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});

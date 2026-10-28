import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { apiRequest } from '../../services/api';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { formatDate } from '../../utils/formatters';
import { THEME } from '../../theme';

interface TripSettingsScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const TripSettingsScreen: React.FC<TripSettingsScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadTrip = async () => {
    try {
      const data = await apiRequest(`/trips/${tripId}`);
      setTrip(data);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  if (loading) {
    return <LoadingIndicator message="Loading trip settings..." />;
  }

  const isCreator = trip?.creatorId === user?.id;
  const isClosed = trip?.status === 'CLOSED';

  const handleCloseTrip = () => {
    Alert.alert(
      'Close Trip',
      'Closing the trip prevents any new expenses from being recorded. Outstanding balances remain intact and settlement payments can still be made.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Trip',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await apiRequest(`/trips/${tripId}/close`, { method: 'POST' });
              Alert.alert('Trip Closed', 'This trip has been closed.');
              loadTrip();
            } catch (err) {
              Alert.alert('Error', (err as Error).message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReopenTrip = () => {
    Alert.alert('Reopen Trip', 'Reopen this trip to allow new expenses again?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reopen',
        onPress: async () => {
          try {
            setActionLoading(true);
            await apiRequest(`/trips/${tripId}/reopen`, { method: 'POST' });
            Alert.alert('Trip Reopened', 'This trip is active again.');
            loadTrip();
          } catch (err) {
            Alert.alert('Error', (err as Error).message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleLeaveTrip = () => {
    Alert.alert(
      'Leave Trip',
      'Leaving this trip disables creating new expenses by you. Any existing debts or credits remain valid.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Trip',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await apiRequest(`/trips/${tripId}/leave`, { method: 'POST' });
              Alert.alert('Left Trip', 'You have left this trip.', [
                { text: 'OK', onPress: () => navigation.navigate('Main') },
              ]);
            } catch (err) {
              Alert.alert('Error', (err as Error).message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>Trip Settings</Text>

        {/* Overview Info Card */}
        <View style={styles.card}>
          <Text style={styles.tripName}>{trip.name}</Text>
          <Text style={styles.tripSub}>
            Destination: {trip.destination || 'Not specified'} · Currency: {trip.currency}
          </Text>
          <Text style={styles.tripSub}>
            Dates: {formatDate(trip.startDate)}
            {trip.endDate ? ` – ${formatDate(trip.endDate)}` : ''}
          </Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Trip Status:</Text>
            <View style={[styles.statusBadge, isClosed && styles.closedBadge]}>
              <Text style={[styles.statusBadgeText, isClosed && styles.closedBadgeText]}>
                {trip.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Navigation Items */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('ExportReport', { tripId })}
          >
            <Text style={styles.navText}>📄 Export Financial Reports (PDF / Excel)</Text>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('TripMembers', { tripId })}
          >
            <Text style={styles.navText}>👥 Manage Trip Members</Text>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>
        </View>

        {/* Creator / Member Lifecycle Actions */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>LIFECYCLE MANAGEMENT</Text>

          {isCreator ? (
            isClosed ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.reopenBtn]}
                onPress={handleReopenTrip}
                disabled={actionLoading}
              >
                <Text style={styles.actionBtnText}>Reopen Trip</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.closeBtn]}
                onPress={handleCloseTrip}
                disabled={actionLoading}
              >
                <Text style={styles.actionBtnText}>Close Trip for Everyone</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.leaveBtn]}
              onPress={handleLeaveTrip}
              disabled={actionLoading}
            >
              <Text style={styles.leaveBtnText}>Leave Trip</Text>
            </TouchableOpacity>
          )}

          {actionLoading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scroll: {
    padding: THEME.spacing.md,
  },
  headerTitle: {
    ...THEME.typography.h1,
    marginBottom: THEME.spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  tripName: {
    ...THEME.typography.h2,
    marginBottom: 4,
  },
  tripSub: {
    ...THEME.typography.bodySmall,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.divider,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  closedBadge: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  closedBadgeText: {
    color: '#64748B',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  navText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  arrow: {
    fontSize: 16,
    color: THEME.colors.textMuted,
  },
  dangerZone: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  dangerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  closeBtn: {
    backgroundColor: '#DC2626',
  },
  reopenBtn: {
    backgroundColor: THEME.colors.primary,
  },
  leaveBtn: {
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  leaveBtnText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
});

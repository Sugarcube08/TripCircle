import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
      'Closing the trip prevents any new expenses from being recorded. Outstanding balances remain intact and settlement payments can still be confirmed.',
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Overview Info Card */}
        <Text style={styles.sectionHeader}>OVERVIEW</Text>
        <View style={styles.card}>
          <Text style={styles.tripName}>{trip.name}</Text>

          {trip.destination ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={THEME.colors.textMuted} style={styles.infoIcon} />
              <Text style={styles.infoText}>{trip.destination}</Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={THEME.colors.textMuted} style={styles.infoIcon} />
            <Text style={styles.infoText}>
              Starts {formatDate(trip.startDate)}
              {trip.endDate ? ` · Ends ${formatDate(trip.endDate)}` : ''}
            </Text>
          </View>

          <View style={styles.statusDivider} />

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Trip State</Text>
            <View style={[styles.statusBadge, isClosed && styles.closedBadge]}>
              <View style={[styles.statusDot, isClosed ? styles.statusDotClosed : styles.statusDotActive]} />
              <Text style={[styles.statusBadgeText, isClosed && styles.closedBadgeText]}>
                {isClosed ? 'Closed (Settling)' : 'Active (Open)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Navigation Items */}
        <Text style={styles.sectionHeader}>TRIP ACTIONS</Text>
        <View style={styles.navCard}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('ExportReport', { tripId })}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="document-text-outline" size={18} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.navText}>Export Financial Reports</Text>
                <Text style={styles.navSub}>Download PDF Ledger or Excel Statement</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textLight} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('TripMembers', { tripId })}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={[styles.iconCircle, { backgroundColor: THEME.colors.primaryLight }]}>
                <Ionicons name="people-outline" size={18} color={THEME.colors.primaryDark} />
              </View>
              <View>
                <Text style={styles.navText}>Manage Trip Members</Text>
                <Text style={styles.navSub}>{trip.members?.length || 0} active members</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textLight} />
          </TouchableOpacity>
        </View>

        {/* Lifecycle Actions */}
        <Text style={styles.sectionHeader}>LIFECYCLE MANAGEMENT</Text>
        <View style={styles.card}>
          {isCreator ? (
            isClosed ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.reopenBtn]}
                onPress={handleReopenTrip}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Reopen Trip</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.closeBtn]}
                onPress={handleCloseTrip}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Close Trip for Everyone</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.leaveBtn]}
              onPress={handleLeaveTrip}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.leaveBtnText}>Leave Trip</Text>
            </TouchableOpacity>
          )}

          {actionLoading && <ActivityIndicator color={THEME.colors.primary} style={{ marginTop: 12 }} />}
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
    paddingBottom: THEME.spacing.xxl,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 8,
    marginTop: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  tripName: {
    ...THEME.typography.h2,
    fontSize: 20,
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  statusDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
  },
  closedBadge: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotClosed: {
    backgroundColor: '#94A3B8',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.credit,
  },
  closedBadgeText: {
    color: THEME.colors.textMuted,
  },
  navCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: THEME.spacing.md,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  navSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 1,
  },
  rowDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginLeft: 62,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
  },
  closeBtn: {
    backgroundColor: THEME.colors.debt,
    ...THEME.shadows.sm,
  },
  reopenBtn: {
    backgroundColor: THEME.colors.primary,
    ...THEME.shadows.sm,
  },
  leaveBtn: {
    borderWidth: 1.5,
    borderColor: THEME.colors.debt,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  leaveBtnText: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '700',
  },
});

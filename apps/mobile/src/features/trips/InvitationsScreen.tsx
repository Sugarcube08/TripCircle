import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { apiRequest } from '../../services/api';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { THEME } from '../../theme';

interface InvitationsScreenProps {
  navigation: any;
}

export const InvitationsScreen: React.FC<InvitationsScreenProps> = ({ navigation }) => {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    try {
      const data = await apiRequest('/invitations');
      setInvitations(data || []);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleRespond = async (invitationId: string, action: 'ACCEPT' | 'DECLINE') => {
    try {
      setActionLoading(invitationId);
      await apiRequest(`/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });

      Alert.alert(
        action === 'ACCEPT' ? 'Invitation Accepted' : 'Invitation Declined',
        `You have ${action.toLowerCase()}ed the invitation.`
      );
      loadInvitations();
    } catch (err) {
      Alert.alert('Response Failed', (err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !refreshing) {
    return <LoadingIndicator message="Checking invitations..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Trip Invitations</Text>

      <FlatList
        data={invitations}
        keyExtractor={(item) => item.invitationId}
        renderItem={({ item }) => (
          <View style={styles.inviteCard}>
            <Text style={styles.tripName}>{item.tripName}</Text>
            <Text style={styles.subtext}>
              Invited by {item.creatorName} · {item.destination || 'Trip'} · Starts {formatDate(item.startDate)}
            </Text>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.btn, styles.acceptBtn]}
                onPress={() => handleRespond(item.invitationId, 'ACCEPT')}
                disabled={actionLoading === item.invitationId}
              >
                <Text style={styles.acceptBtnText}>Accept Invitation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.declineBtn]}
                onPress={() => handleRespond(item.invitationId, 'DECLINE')}
                disabled={actionLoading === item.invitationId}
              >
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No Pending Invitations"
            message="When friends invite you to their trip, invitations will show up here."
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadInvitations} colors={[THEME.colors.primary]} />
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  headerTitle: {
    ...THEME.typography.h1,
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  list: {
    padding: THEME.spacing.md,
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tripName: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  subtext: {
    ...THEME.typography.bodySmall,
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: THEME.colors.primary,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  declineBtn: {
    backgroundColor: '#F1F5F9',
  },
  declineBtnText: {
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});

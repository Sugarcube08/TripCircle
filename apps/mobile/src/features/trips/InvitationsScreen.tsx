import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { ScreenHeader, dialog } from '../../components/ui';
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
      dialog.alert('Error', (err as Error).message, 'error');
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

      await dialog.alert(
        action === 'ACCEPT' ? 'Invitation Accepted' : 'Invitation Declined',
        `You have ${action.toLowerCase()}ed the invitation.`,
        action === 'ACCEPT' ? 'success' : 'info'
      );
      loadInvitations();
    } catch (err) {
      dialog.alert('Response Failed', (err as Error).message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !refreshing) {
    return <LoadingIndicator message="Checking invitations..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      <ScreenHeader title="Trip Invitations" onBack={() => navigation.goBack()} />

      <FlatList
        data={invitations}
        keyExtractor={(item) => item.invitationId}
        renderItem={({ item }) => {
          const isActing = actionLoading === item.invitationId;

          return (
            <View style={styles.inviteCard}>
              <View style={styles.cardHeader}>
                <View style={styles.emblemCircle}>
                  <Text style={styles.emblemText}>
                    {item.tripName ? item.tripName.substring(0, 2).toUpperCase() : 'TC'}
                  </Text>
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.tripName} numberOfLines={1}>
                    {item.tripName}
                  </Text>
                  <Text style={styles.inviterText}>
                    Invited by <Text style={{ fontWeight: '700', color: THEME.colors.textPrimary }}>{item.creatorName}</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                {item.destination ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color={THEME.colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={styles.metaText}>{item.destination}</Text>
                  </View>
                ) : null}

                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={THEME.colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.metaText}>Starts {formatDate(item.startDate)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.acceptBtn, isActing && styles.btnDisabled]}
                  onPress={() => handleRespond(item.invitationId, 'ACCEPT')}
                  disabled={isActing}
                  activeOpacity={0.85}
                >
                  {isActing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.declineBtn, isActing && styles.btnDisabled]}
                  onPress={() => handleRespond(item.invitationId, 'DECLINE')}
                  disabled={isActing}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close-sharp" size={16} color={THEME.colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No Pending Invitations"
            message="When friends invite you to join their trip circle, requests will arrive here."
            icon="mail-unread-outline"
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadInvitations} colors={[THEME.colors.primary]} />
        }
        contentContainerStyle={styles.list}
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
  list: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  inviteCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  emblemCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emblemText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  headerText: {
    flex: 1,
  },
  tripName: {
    ...THEME.typography.h3,
    fontSize: 16,
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  inviterText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: THEME.borderRadius.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  acceptBtn: {
    backgroundColor: THEME.colors.primary,
  },
  acceptBtnText: {
    color: '#0B0F19',
    fontWeight: '700',
    fontSize: 14,
  },
  declineBtn: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  declineBtnText: {
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});

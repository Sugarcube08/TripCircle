import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { AmountText } from '../../components/AmountText';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { THEME } from '../../theme';

interface TripMembersScreenProps {
  route: any;
  navigation: any;
  user: any;
}

export const TripMembersScreen: React.FC<TripMembersScreenProps> = ({
  route,
  navigation,
  user,
}) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmailOrId, setInviteEmailOrId] = useState('');
  const [inviting, setInviting] = useState(false);

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

  const handleInvite = async () => {
    if (!inviteEmailOrId.trim()) {
      Alert.alert('Required', 'Please enter an email or username to invite.');
      return;
    }

    try {
      setInviting(true);
      await apiRequest(`/trips/${tripId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userIdOrEmail: inviteEmailOrId.trim() }),
      });
      setInviteEmailOrId('');
      Alert.alert('Success', 'Invitation sent successfully!');
      loadTrip();
    } catch (err) {
      Alert.alert('Invite Failed', (err as Error).message);
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading trip members..." />;
  }

  const members = trip?.members || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Members</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{members.length}</Text>
        </View>
      </View>

      {/* Invite Box */}
      <View style={styles.inviteContainer}>
        <Text style={styles.sectionHeader}>ADD NEW MEMBER</Text>
        <View style={styles.inviteInputRow}>
          <Ionicons name="mail-outline" size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.inviteInput}
            placeholder="Enter friend's email or user ID..."
            placeholderTextColor={THEME.colors.textLight}
            value={inviteEmailOrId}
            onChangeText={setInviteEmailOrId}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.inviteBtn, inviting && styles.btnDisabled]}
            onPress={handleInvite}
            disabled={inviting}
            activeOpacity={0.8}
          >
            {inviting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.inviteBtnText}>Invite</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isYou = item.userId === user?.id;
          const isCreator = item.role === 'CREATOR';
          const isPending = item.status === 'PENDING_INVITE';

          return (
            <TouchableOpacity
              style={styles.memberCard}
              onPress={() => navigation.navigate('MemberProfile', { tripId, memberId: item.id })}
              activeOpacity={0.75}
            >
              <MemberAvatar name={item.user.name} avatarUrl={item.user.avatarUrl} size={46} />
              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.user.name} {isYou ? '(You)' : ''}
                  </Text>
                  {isCreator && (
                    <View style={styles.creatorBadge}>
                      <Ionicons name="star" size={10} color="#D97706" style={{ marginRight: 2 }} />
                      <Text style={styles.creatorText}>Host</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.email} numberOfLines={1}>
                  {item.user.email}
                </Text>

                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusPill,
                      isPending ? styles.statusPillPending : styles.statusPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isPending ? styles.statusTextPending : styles.statusTextActive,
                      ]}
                    >
                      {isPending ? 'Invite Pending' : 'Active Member'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.rightCol}>
                <AmountText paise={item.netBalancePaise || 0} size="medium" />
                <Ionicons name="chevron-forward" size={16} color={THEME.colors.textLight} style={{ marginTop: 4 }} />
              </View>
            </TouchableOpacity>
          );
        }}
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
    backgroundColor: '#FFFFFF',
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
  countBadge: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  inviteContainer: {
    backgroundColor: '#FFFFFF',
    padding: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 8,
  },
  inviteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingLeft: 12,
    paddingRight: 4,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  inviteInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  inviteBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  inviteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  list: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    ...THEME.shadows.sm,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  creatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  email: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  statusRow: {
    marginTop: 4,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  statusPillActive: {
    backgroundColor: '#ECFDF5',
  },
  statusPillPending: {
    backgroundColor: '#FFFBEB',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextPending: {
    color: '#D97706',
  },
  rightCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
});

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
} from 'react-native';
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
      Alert.alert('Required', 'Please enter an email or username');
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
    return <LoadingIndicator message="Loading members..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inviteBox}>
        <Text style={styles.inviteLabel}>INVITE MEMBER</Text>
        <View style={styles.inviteInputRow}>
          <TextInput
            style={styles.inviteInput}
            placeholder="Search email or user ID..."
            value={inviteEmailOrId}
            onChangeText={setInviteEmailOrId}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={handleInvite}
            disabled={inviting}
          >
            <Text style={styles.inviteBtnText}>{inviting ? '...' : 'Invite'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={trip?.members || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.memberCard}
            onPress={() => navigation.navigate('MemberProfile', { tripId, memberId: item.id })}
          >
            <MemberAvatar name={item.user.name} avatarUrl={item.user.avatarUrl} size={44} />
            <View style={styles.memberInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.user.name}</Text>
                {item.role === 'CREATOR' ? (
                  <View style={styles.creatorBadge}>
                    <Text style={styles.creatorText}>Creator</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.email}>{item.user.email}</Text>
              <Text style={styles.status}>Status: {item.status}</Text>
            </View>

            <View style={styles.balanceCol}>
              <AmountText paise={item.netBalancePaise || 0} size="medium" />
            </View>
          </TouchableOpacity>
        )}
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
  inviteBox: {
    backgroundColor: '#FFFFFF',
    padding: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  inviteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  inviteInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  inviteBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  list: {
    padding: THEME.spacing.md,
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
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  status: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  balanceCol: {
    alignItems: 'flex-end',
  },
});

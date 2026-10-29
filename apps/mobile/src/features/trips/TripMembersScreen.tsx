import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  apiRequest,
  addDummyMember,
  replaceDummyMember,
  searchRegisteredUsers,
  ApiError,
} from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { AmountText } from '../../components/AmountText';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Badge } from '../../components/ui/Badge';
import { ScreenHeader, SegmentedControl, dialog } from '../../components/ui';
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

  // Add tab: 'REGISTERED' | 'OFFLINE'
  const [activeTab, setActiveTab] = useState<'REGISTERED' | 'OFFLINE'>('REGISTERED');

  // Registered invite inputs
  const [inviteEmailOrId, setInviteEmailOrId] = useState('');
  const [inviting, setInviting] = useState(false);

  // Offline member inputs
  const [offlineName, setOfflineName] = useState('');
  const [offlinePhone, setOfflinePhone] = useState('');
  const [addingOffline, setAddingOffline] = useState(false);

  // Replace dummy member modal
  const [selectedDummyMember, setSelectedDummyMember] = useState<any | null>(null);
  const [replaceSearchQuery, setReplaceSearchQuery] = useState('');
  const [replaceSearchResults, setReplaceSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const loadTrip = async () => {
    try {
      const data = await apiRequest(`/trips/${tripId}`);
      setTrip(data);
    } catch (err) {
      dialog.alert('Error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  const handleInvite = async () => {
    if (!inviteEmailOrId.trim()) {
      dialog.alert('Required', 'Please enter an email or username to invite.', 'warning');
      return;
    }

    try {
      setInviting(true);
      await apiRequest(`/trips/${tripId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userIdOrEmail: inviteEmailOrId.trim() }),
      });
      setInviteEmailOrId('');
      dialog.alert('Success', 'Invitation sent successfully!', 'success');
      loadTrip();
    } catch (err) {
      dialog.alert('Invite Failed', (err as Error).message, 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleAddOffline = async () => {
    if (!offlineName.trim()) {
      dialog.alert('Required', 'Please enter a name for the offline member.', 'warning');
      return;
    }

    try {
      setAddingOffline(true);
      await addDummyMember(tripId, {
        name: offlineName.trim(),
        phone: offlinePhone.trim() || undefined,
      });
      setOfflineName('');
      setOfflinePhone('');
      dialog.alert('Member Added', 'Offline member added to the trip. They can now participate in expenses.', 'success');
      loadTrip();
    } catch (err) {
      dialog.alert('Failed to Add Member', (err as Error).message, 'error');
    } finally {
      setAddingOffline(false);
    }
  };

  const replaceSearchTimerRef = React.useRef<any>(null);
  const replaceSearchSequenceRef = React.useRef(0);

  useEffect(() => {
    return () => {
      if (replaceSearchTimerRef.current) {
        clearTimeout(replaceSearchTimerRef.current);
      }
    };
  }, []);

  const handleSearchReplaceUsers = (text: string) => {
    setReplaceSearchQuery(text);
    if (replaceSearchTimerRef.current) {
      clearTimeout(replaceSearchTimerRef.current);
    }

    if (text.trim().length < 2) {
      setReplaceSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    const seq = ++replaceSearchSequenceRef.current;
    replaceSearchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchRegisteredUsers(text.trim());
        if (seq === replaceSearchSequenceRef.current) {
          // Filter out users already in the trip
          const existingUserIds = new Set((trip?.members || []).map((m: any) => m.userId).filter(Boolean));
          const filtered = (results || []).filter((u: any) => !existingUserIds.has(u.id));
          setReplaceSearchResults(filtered);
        }
      } catch {
        if (seq === replaceSearchSequenceRef.current) {
          setReplaceSearchResults([]);
        }
      } finally {
        if (seq === replaceSearchSequenceRef.current) {
          setSearchingUsers(false);
        }
      }
    }, 250);
  };

  const handleConfirmReplace = async (targetUser: any) => {
    if (!selectedDummyMember) return;

    const confirmed = await dialog.confirm(
      'Link Registered Account',
      `Are you sure you want to link ${targetUser.name} (${targetUser.email}) to "${selectedDummyMember.displayName || 'Offline Member'}"?\n\n100% of expenses, splits, and balances will be securely attached to this user account without creating duplicates.`,
      { confirmText: 'Confirm & Link', type: 'info' }
    );

    if (!confirmed) return;

    try {
      setReplacing(true);
      await replaceDummyMember(tripId, selectedDummyMember.id, {
        registeredUserId: targetUser.id,
      });
      await dialog.alert('Account Linked', `Successfully linked ${targetUser.name} to this trip.`, 'success');
      setSelectedDummyMember(null);
      setReplaceSearchQuery('');
      setReplaceSearchResults([]);
      loadTrip();
    } catch (err) {
      dialog.alert('Replacement Failed', (err as Error).message, 'error');
    } finally {
      setReplacing(false);
    }
  };

  if (loading) {
    return <LoadingIndicator message="Loading trip members..." />;
  }

  const members = trip?.members || [];
  const isCreator = trip?.creatorId === user?.id;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      <ScreenHeader
        title="Trip Members"
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{members.length}</Text>
          </View>
        }
      />

      {/* Add Member Container */}
      <View style={styles.inviteContainer}>
        {/* Tab Switcher */}
        <SegmentedControl
          options={[
            { id: 'REGISTERED', label: 'Invite User', icon: 'person-add-outline' },
            { id: 'OFFLINE', label: 'Add Offline', icon: 'people-outline' },
          ]}
          selectedId={activeTab}
          onSelect={(id) => setActiveTab(id as any)}
          style={{ marginBottom: 12 }}
        />

        {activeTab === 'REGISTERED' ? (
          <View style={styles.inviteInputRow}>
            <Ionicons name="mail-outline" size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.inviteInput}
              placeholder="Friend's email or registered user ID..."
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
                <ActivityIndicator size="small" color="#0B0F19" />
              ) : (
                <Text style={styles.inviteBtnText}>Invite</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.offlineBox}>
            <View style={styles.offlineInputsRow}>
              <TextInput
                style={[styles.inviteInput, { marginRight: 8 }]}
                placeholder="Name * (e.g. Rahul)"
                placeholderTextColor={THEME.colors.textLight}
                value={offlineName}
                onChangeText={setOfflineName}
              />
              <TextInput
                style={[styles.inviteInput, { flex: 0.8 }]}
                placeholder="Phone (Optional)"
                placeholderTextColor={THEME.colors.textLight}
                value={offlinePhone}
                onChangeText={setOfflinePhone}
                keyboardType="phone-pad"
              />
            </View>
            <TouchableOpacity
              style={[styles.addOfflineBtn, addingOffline && styles.btnDisabled]}
              onPress={handleAddOffline}
              disabled={addingOffline}
              activeOpacity={0.8}
            >
              {addingOffline ? (
                <ActivityIndicator size="small" color="#0B0F19" />
              ) : (
                <Text style={styles.inviteBtnText}>+ Add Offline Member</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isYou = item.userId === user?.id;
          const isTripCreator = item.role === 'CREATOR';
          const isPending = item.status === 'INVITED';
          const isDummy = item.isDummy || !item.userId;
          const memberDisplayName = item.displayName || item.user?.name || 'Offline Member';

          return (
            <TouchableOpacity
              style={styles.memberCard}
              onPress={() => navigation.navigate('MemberProfile', { tripId, memberId: item.id })}
              activeOpacity={0.75}
            >
              <MemberAvatar
                name={memberDisplayName}
                avatarUrl={item.user?.avatarUrl}
                size={46}
              />
              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {memberDisplayName} {isYou ? '(You)' : ''}
                  </Text>
                  {isTripCreator && (
                    <Badge label="Host" size="sm" variant="warning" style={{ marginLeft: 4 }} />
                  )}
                  {isDummy && (
                    <Badge label="OFFLINE" size="sm" variant="secondary" style={{ marginLeft: 4 }} />
                  )}
                </View>

                <Text style={styles.email} numberOfLines={1}>
                  {isDummy ? item.phone || item.email || 'Offline Participant' : item.user?.email}
                </Text>

                <View style={styles.statusRow}>
                  {isPending ? (
                    <Badge label="Invite Pending" size="sm" variant="warning" />
                  ) : isDummy ? (
                    <View style={styles.dummyActionsRow}>
                      <Badge label="Full Ledger Participant" size="sm" variant="outline" />
                      {isCreator && (
                        <TouchableOpacity
                          style={styles.linkAccountBtn}
                          onPress={() => setSelectedDummyMember(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="link-outline" size={13} color={THEME.colors.primary} style={{ marginRight: 3 }} />
                          <Text style={styles.linkAccountBtnText}>Link Account</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <Badge label="Active Member" size="sm" variant="success" />
                  )}
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

      {/* Link Account / Replace Dummy Member Modal */}
      <Modal
        visible={!!selectedDummyMember}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDummyMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Link Registered Account</Text>
                <Text style={styles.modalSubtitle}>
                  Replace "{selectedDummyMember?.displayName}" with a registered user
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedDummyMember(null);
                  setReplaceSearchQuery('');
                  setReplaceSearchResults([]);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchRow}>
              <Ionicons name="search" size={18} color={THEME.colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search user by name or email..."
                placeholderTextColor={THEME.colors.textLight}
                value={replaceSearchQuery}
                onChangeText={handleSearchReplaceUsers}
                autoCapitalize="none"
                autoFocus
              />
              {searchingUsers && <ActivityIndicator size="small" color={THEME.colors.primary} />}
            </View>

            {replacing ? (
              <View style={styles.replacingLoading}>
                <ActivityIndicator size="large" color={THEME.colors.primary} />
                <Text style={styles.replacingText}>Linking account & updating ledger...</Text>
              </View>
            ) : replaceSearchResults.length > 0 ? (
              <FlatList
                data={replaceSearchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userResultRow}
                    onPress={() => handleConfirmReplace(item)}
                    activeOpacity={0.7}
                  >
                    <MemberAvatar name={item.name} avatarUrl={item.avatarUrl} size={36} />
                    <View style={styles.userResultInfo}>
                      <Text style={styles.userResultName}>{item.name}</Text>
                      <Text style={styles.userResultEmail}>{item.email}</Text>
                    </View>
                    <View style={styles.linkSelectBtn}>
                      <Text style={styles.linkSelectBtnText}>Select</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 280 }}
              />
            ) : replaceSearchQuery.length >= 2 ? (
              <View style={styles.noResultsBox}>
                <Ionicons name="search-outline" size={32} color={THEME.colors.textMuted} />
                <Text style={styles.noResultsText}>No available users found matching "{replaceSearchQuery}"</Text>
              </View>
            ) : (
              <View style={styles.modalHelpBox}>
                <Ionicons name="information-circle-outline" size={20} color={THEME.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalHelpText}>
                  Type at least 2 characters to search registered TripCircle users.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  countBadge: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.25)',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  inviteContainer: {
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  inviteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingLeft: 12,
    paddingRight: 4,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  inviteInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.textPrimary,
    minHeight: 44,
  },
  inviteBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBox: {
    gap: 8,
  },
  offlineInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addOfflineBtn: {
    backgroundColor: THEME.colors.primary,
    minHeight: 44,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  inviteBtnText: {
    color: '#0B0F19',
    fontWeight: '700',
    fontSize: 13,
  },
  list: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  memberCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
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
  email: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  statusRow: {
    marginTop: 6,
  },
  dummyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.3)',
    minHeight: 32,
  },
  linkAccountBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  rightCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderTopLeftRadius: THEME.borderRadius.xl,
    borderTopRightRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: THEME.spacing.md,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.textPrimary,
    minHeight: 44,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
    minHeight: 52,
  },
  userResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  userResultEmail: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  linkSelectBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  linkSelectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B0F19',
  },
  noResultsBox: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  modalHelpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    marginVertical: 12,
  },
  modalHelpText: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  replacingLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  replacingText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginTop: 12,
  },
});

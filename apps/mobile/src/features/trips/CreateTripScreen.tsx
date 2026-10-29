import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, uploadImageFromUri, addDummyMember } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { CalendarModal } from '../../components/CalendarModal';
import { Badge } from '../../components/ui/Badge';
import { dialog } from '../../components/ui';
import { THEME } from '../../theme';

interface CreateTripScreenProps {
  navigation: any;
}

export const CreateTripScreen: React.FC<CreateTripScreenProps> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // Cover photo state
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Members state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
  const [offlineMembers, setOfflineMembers] = useState<{ id: string; name: string }[]>([]);
  const [offlineNameInput, setOfflineNameInput] = useState('');
  const [showAddOffline, setShowAddOffline] = useState(false);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Formatter for display
  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return 'Not set (Optional)';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handlePickCover = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        dialog.alert('Permission Required', 'Permission to access photos is needed to choose a cover image.', 'warning');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setCoverImageUri(res.assets[0].uri);
      }
    } catch (err) {
      dialog.alert('Image Picker Error', (err as Error).message, 'error');
    }
  };

  const searchTimerRef = React.useRef<any>(null);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await apiRequest(`/users/search?q=${encodeURIComponent(text.trim())}`);
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const addInvitee = (user: any) => {
    if (!invitedUsers.some((u) => u.id === user.id)) {
      setInvitedUsers([...invitedUsers, user]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeInvitee = (userId: string) => {
    setInvitedUsers(invitedUsers.filter((u) => u.id !== userId));
  };

  const handleAddOfflineMember = () => {
    const trimmed = offlineNameInput.trim();
    if (!trimmed) {
      dialog.alert('Name Required', 'Please enter a name for the offline member.', 'warning');
      return;
    }
    const tempId = `offline-${Date.now()}`;
    setOfflineMembers([...offlineMembers, { id: tempId, name: trimmed }]);
    setOfflineNameInput('');
    setShowAddOffline(false);
  };

  const removeOfflineMember = (id: string) => {
    setOfflineMembers(offlineMembers.filter((m) => m.id !== id));
  };

  const handleCreateTrip = async () => {
    if (!name.trim()) {
      dialog.alert('Required', 'Please enter a name for your trip.', 'warning');
      return;
    }

    if (endDate && endDate < startDate) {
      dialog.alert('Invalid Date Range', 'End date cannot be earlier than start date.', 'warning');
      return;
    }

    try {
      setLoading(true);

      let finalCoverUrl: string | undefined = undefined;

      // Upload cover image if picked
      if (coverImageUri) {
        setUploadingCover(true);
        const uploaded = await uploadImageFromUri(coverImageUri, 'TRIP_COVER');
        finalCoverUrl = uploaded.publicUrl;
      }

      const trip = await apiRequest('/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          destination: destination.trim() || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          coverImageUrl: finalCoverUrl,
          currency: 'INR',
          initialInvitedUserIds: invitedUsers.map((u) => u.id),
        }),
      });

      // If offline members were added, create them concurrently
      if (offlineMembers.length > 0) {
        await Promise.all(
          offlineMembers.map((m) =>
            addDummyMember(trip.id, { name: m.name }).catch(() => null)
          )
        );
      }

      navigation.replace('TripDashboard', { tripId: trip.id });
    } catch (err) {
      dialog.alert('Failed to Create Trip', (err as Error).message, 'error');
    } finally {
      setLoading(false);
      setUploadingCover(false);
    }
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
        <Text style={styles.headerTitle}>Create Trip</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Trip Essentials */}
          <Text style={styles.sectionHeader}>TRIP ESSENTIALS</Text>
          <View style={styles.card}>
            {/* Trip Name */}
            <View style={styles.fieldRow}>
              <Ionicons name="airplane-outline" size={20} color={THEME.colors.primary} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Trip Name * (e.g. Goa Vacation, Manali Trek)"
                placeholderTextColor={THEME.colors.textLight}
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            <View style={styles.divider} />

            {/* Destination */}
            <View style={styles.fieldRow}>
              <Ionicons name="location-outline" size={20} color={THEME.colors.primary} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Destination (Optional)"
                placeholderTextColor={THEME.colors.textLight}
                value={destination}
                onChangeText={setDestination}
              />
            </View>
          </View>

          {/* Dates Card */}
          <Text style={styles.sectionHeader}>CALENDAR DATES</Text>
          <View style={styles.card}>
            {/* Start Date Picker */}
            <TouchableOpacity
              style={styles.datePickerRow}
              onPress={() => setShowStartCalendar(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dateRowLeft}>
                <Ionicons name="calendar-outline" size={20} color={THEME.colors.primary} style={styles.fieldIcon} />
                <View>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValueText}>{formatDateDisplay(startDate)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* End Date Picker */}
            <TouchableOpacity
              style={styles.datePickerRow}
              onPress={() => setShowEndCalendar(true)}
              activeOpacity={0.7}
            >
              <View style={styles.dateRowLeft}>
                <Ionicons name="calendar-outline" size={20} color={THEME.colors.textMuted} style={styles.fieldIcon} />
                <View>
                  <Text style={styles.dateLabel}>End Date (Optional)</Text>
                  <Text style={[styles.dateValueText, !endDate && { color: THEME.colors.textLight }]}>
                    {formatDateDisplay(endDate)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Cover Photo */}
          <Text style={styles.sectionHeader}>COVER PHOTO (OPTIONAL)</Text>
          <View style={styles.card}>
            {coverImageUri ? (
              <View style={styles.coverPreviewContainer}>
                <Image source={{ uri: coverImageUri }} style={styles.coverPreviewImage} resizeMode="cover" />
                <View style={styles.coverActionRow}>
                  <TouchableOpacity
                    style={styles.coverActionBtn}
                    onPress={handlePickCover}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-outline" size={16} color={THEME.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.coverActionText}>Replace Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.coverActionBtn, { borderColor: THEME.colors.debtBorder }]}
                    onPress={() => setCoverImageUri(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={THEME.colors.debt} style={{ marginRight: 6 }} />
                    <Text style={[styles.coverActionText, { color: THEME.colors.debt }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadCoverBox}
                onPress={handlePickCover}
                activeOpacity={0.75}
              >
                <View style={styles.uploadIconCircle}>
                  <Ionicons name="image-outline" size={24} color={THEME.colors.primary} />
                </View>
                <Text style={styles.uploadCoverTitle}>Choose Cover Photo</Text>
                <Text style={styles.uploadCoverSubtitle}>Pick a landscape photo from your gallery</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Member Search & Invite */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderInline}>PARTICIPANTS & MEMBERS</Text>
            <TouchableOpacity
              onPress={() => setShowAddOffline(!showAddOffline)}
              style={styles.addOfflineToggle}
            >
              <Ionicons name={showAddOffline ? 'close' : 'person-add'} size={14} color={THEME.colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.addOfflineToggleText}>
                {showAddOffline ? 'Cancel' : '+ Offline Member'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Offline Member Quick Add Box */}
          {showAddOffline && (
            <View style={styles.offlineInputCard}>
              <Text style={styles.offlineCardTitle}>Add Member Without Account</Text>
              <Text style={styles.offlineCardDesc}>
                Add friends who haven't installed TripCircle. They will be included in all splits and can be linked later.
              </Text>
              <View style={styles.offlineInputRow}>
                <TextInput
                  style={styles.offlineTextInput}
                  placeholder="Friend's Name (e.g. Rahul Sharma)"
                  placeholderTextColor={THEME.colors.textLight}
                  value={offlineNameInput}
                  onChangeText={setOfflineNameInput}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.offlineAddBtn}
                  onPress={handleAddOfflineMember}
                  activeOpacity={0.8}
                >
                  <Text style={styles.offlineAddBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Ionicons name="search-outline" size={20} color={THEME.colors.textMuted} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Search registered user by name or email..."
                placeholderTextColor={THEME.colors.textLight}
                value={searchQuery}
                onChangeText={handleSearch}
                autoCapitalize="none"
              />
              {searching && <ActivityIndicator size="small" color={THEME.colors.primary} />}
            </View>

            {searchResults.length > 0 && (
              <View style={styles.searchResultsBox}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.searchItem}
                    onPress={() => addInvitee(item)}
                    activeOpacity={0.7}
                  >
                    <MemberAvatar name={item.name} avatarUrl={item.avatarUrl} size={34} />
                    <View style={styles.searchItemInfo}>
                      <Text style={styles.searchItemName}>{item.name}</Text>
                      <Text style={styles.searchItemEmail}>{item.email}</Text>
                    </View>
                    <View style={styles.addBtnPill}>
                      <Text style={styles.addBtnText}>+ Add</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Selected Invited Chips */}
            {(invitedUsers.length > 0 || offlineMembers.length > 0) && (
              <View style={styles.inviteesWrapper}>
                <Text style={styles.inviteesCountLabel}>
                  {invitedUsers.length + offlineMembers.length} PARTICIPANT{invitedUsers.length + offlineMembers.length > 1 ? 'S' : ''} ADDED
                </Text>
                <View style={styles.chipsWrap}>
                  {invitedUsers.map((u) => (
                    <View key={u.id} style={styles.userChip}>
                      <MemberAvatar name={u.name} avatarUrl={u.avatarUrl} size={22} />
                      <Text style={styles.userChipText}>{u.name}</Text>
                      <TouchableOpacity
                        onPress={() => removeInvitee(u.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close-circle" size={16} color={THEME.colors.textMuted} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {offlineMembers.map((m) => (
                    <View key={m.id} style={[styles.userChip, styles.offlineChip]}>
                      <View style={styles.offlineAvatar}>
                        <Text style={styles.offlineAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.userChipText}>{m.name}</Text>
                      <Badge label="OFFLINE" size="sm" variant="secondary" style={{ marginLeft: 4 }} />
                      <TouchableOpacity
                        onPress={() => removeOfflineMember(m.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close-circle" size={16} color={THEME.colors.textMuted} style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.createBtn, loading && styles.btnDisabled]}
            onPress={handleCreateTrip}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.createBtnText}>
                  {uploadingCover ? 'Uploading Cover Photo...' : 'Creating Trip...'}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="compass-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.createBtnText}>Create Trip & Begin</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Calendar Modals */}
      <CalendarModal
        visible={showStartCalendar}
        onClose={() => setShowStartCalendar(false)}
        onSelectDate={(d) => {
          setStartDate(d);
          if (endDate && endDate < d) {
            setEndDate('');
          }
        }}
        selectedDate={startDate}
        title="Select Start Date"
      />

      <CalendarModal
        visible={showEndCalendar}
        onClose={() => setShowEndCalendar(false)}
        onSelectDate={setEndDate}
        selectedDate={endDate}
        minDate={startDate}
        title="Select End Date"
        allowClear
        onClear={() => setEndDate('')}
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
    marginTop: 8,
    marginLeft: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderInline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
  },
  addOfflineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  addOfflineToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  offlineInputCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.35)',
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  offlineCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  offlineCardDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  offlineInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  offlineTextInput: {
    flex: 1,
    backgroundColor: THEME.colors.inputBg,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  offlineAddBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    marginBottom: 2,
  },
  dateValueText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  fieldIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
  },
  coverPreviewContainer: {
    paddingVertical: THEME.spacing.md,
  },
  coverPreviewImage: {
    width: '100%',
    height: 160,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.cardAlt,
  },
  coverActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
  },
  coverActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.cardAlt,
  },
  coverActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  uploadCoverBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadCoverTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  uploadCoverSubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  searchResultsBox: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  searchItemInfo: {
    marginLeft: 10,
    flex: 1,
  },
  searchItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  searchItemEmail: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  addBtnPill: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.full,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  inviteesWrapper: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
    paddingTop: 12,
    paddingBottom: 8,
  },
  inviteesCountLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardAlt,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  offlineChip: {
    borderColor: 'rgba(13, 148, 136, 0.4)',
  },
  offlineAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  userChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginLeft: 6,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 15,
    marginTop: THEME.spacing.sm,
    ...THEME.shadows.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

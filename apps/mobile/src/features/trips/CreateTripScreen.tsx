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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { THEME } from '../../theme';

interface CreateTripScreenProps {
  navigation: any;
}

export const CreateTripScreen: React.FC<CreateTripScreenProps> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const results = await apiRequest(`/users/search?q=${encodeURIComponent(text.trim())}`);
      setSearchResults(results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
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

  const handleCreateTrip = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a name for your trip.');
      return;
    }

    try {
      setLoading(true);
      const trip = await apiRequest('/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          destination: destination.trim() || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          coverImageUrl: coverImageUrl.trim() || undefined,
          currency: 'INR',
          initialInvitedUserIds: invitedUsers.map((u) => u.id),
        }),
      });

      navigation.replace('TripDashboard', { tripId: trip.id });
    } catch (err) {
      Alert.alert('Failed to Create Trip', (err as Error).message);
    } finally {
      setLoading(false);
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
          <Text style={styles.sectionHeader}>DATES</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Ionicons name="calendar-outline" size={20} color={THEME.colors.textMuted} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Start Date (YYYY-MM-DD)"
                placeholderTextColor={THEME.colors.textLight}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldRow}>
              <Ionicons name="calendar-outline" size={20} color={THEME.colors.textMuted} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="End Date (YYYY-MM-DD, Optional)"
                placeholderTextColor={THEME.colors.textLight}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>

          {/* Cover Photo */}
          <Text style={styles.sectionHeader}>COVER PHOTO (OPTIONAL)</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Ionicons name="image-outline" size={20} color={THEME.colors.textMuted} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="https://... cover image URL"
                placeholderTextColor={THEME.colors.textLight}
                value={coverImageUrl}
                onChangeText={setCoverImageUrl}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Member Search & Invite */}
          <Text style={styles.sectionHeader}>INVITE MEMBERS</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Ionicons name="person-add-outline" size={20} color={THEME.colors.textMuted} style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Search friend by name or email..."
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
            {invitedUsers.length > 0 && (
              <View style={styles.inviteesWrapper}>
                <Text style={styles.inviteesCountLabel}>
                  {invitedUsers.length} FRIEND{invitedUsers.length > 1 ? 'S' : ''} ADDED
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
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="compass-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.createBtnText}>Create Trip & Begin</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.borderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 8,
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

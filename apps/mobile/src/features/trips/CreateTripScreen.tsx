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
  FlatList,
} from 'react-native';
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
      Alert.alert('Required', 'Please enter a trip name');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.screenTitle}>Create a New Trip</Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Trip Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Goa Trip, Ladakh Roadtrip"
          placeholderTextColor="#94A3B8"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Destination (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Goa, India"
          placeholderTextColor="#94A3B8"
          value={destination}
          onChangeText={setDestination}
        />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>End Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
        </View>

        <Text style={styles.label}>Cover Image URL (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor="#94A3B8"
          value={coverImageUrl}
          onChangeText={setCoverImageUrl}
        />

        {/* Member Search & Invitation */}
        <Text style={[styles.label, { marginTop: 16 }]}>Invite Friends</Text>
        <TextInput
          style={styles.input}
          placeholder="Search by name or email..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={handleSearch}
        />

        {searching ? <ActivityIndicator size="small" style={{ marginVertical: 8 }} /> : null}

        {searchResults.length > 0 ? (
          <View style={styles.resultsContainer}>
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.searchItem}
                onPress={() => addInvitee(item)}
              >
                <MemberAvatar name={item.name} avatarUrl={item.avatarUrl} size={32} />
                <View style={styles.searchItemText}>
                  <Text style={styles.searchItemName}>{item.name}</Text>
                  <Text style={styles.searchItemEmail}>{item.email}</Text>
                </View>
                <Text style={styles.addText}>+ Add</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Selected Invitees List */}
        {invitedUsers.length > 0 ? (
          <View style={styles.inviteesSection}>
            <Text style={styles.inviteesTitle}>Invited ({invitedUsers.length})</Text>
            <View style={styles.chipsRow}>
              {invitedUsers.map((u) => (
                <View key={u.id} style={styles.chip}>
                  <Text style={styles.chipText}>{u.name}</Text>
                  <TouchableOpacity onPress={() => removeInvitee(u.id)}>
                    <Text style={styles.chipRemove}> ✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.createBtn}
          onPress={handleCreateTrip}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.createBtnText}>Create Trip & Begin</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scroll: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  screenTitle: {
    ...THEME.typography.h1,
    marginVertical: THEME.spacing.md,
  },
  formCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    marginTop: 4,
    maxHeight: 180,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  searchItemText: {
    flex: 1,
    marginLeft: 10,
  },
  searchItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  searchItemEmail: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  addText: {
    color: THEME.colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  inviteesSection: {
    marginTop: 14,
  },
  inviteesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: THEME.colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: THEME.borderRadius.full,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.primaryDark,
  },
  chipRemove: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
    marginLeft: 4,
  },
  createBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 15,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.xl,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

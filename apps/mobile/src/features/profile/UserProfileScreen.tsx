import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { apiRequest } from '../../services/api';
import { clearTokens } from '../../storage/secureStore';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { THEME } from '../../theme';

interface UserProfileScreenProps {
  navigation: any;
  user: any;
  onLogout: () => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  navigation,
  user,
  onLogout,
}) => {
  const [profile, setProfile] = useState<any>(user);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchMe() {
      try {
        setLoading(true);
        const data = await apiRequest('/users/me');
        setProfile(data);
      } catch {
        // Fallback to initial user prop
      } finally {
        setLoading(false);
      }
    }
    fetchMe();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of tripCircle?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await clearTokens();
          onLogout();
        },
      },
    ]);
  };

  if (loading && !profile) {
    return <LoadingIndicator message="Loading profile..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>My Profile</Text>

        <View style={styles.profileCard}>
          <MemberAvatar name={profile?.name || 'User'} avatarUrl={profile?.avatarUrl} size={72} />
          <Text style={styles.name}>{profile?.name}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          {profile?.phone ? <Text style={styles.phone}>{profile?.phone}</Text> : null}

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile?.completedTripCount || 0}</Text>
            <Text style={styles.statLabel}>Completed Trips</Text>
          </View>
        </View>

        <View style={styles.optionsCard}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => navigation.navigate('Invitations')}
          >
            <Text style={styles.optionText}>📩 Trip Invitations</Text>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => Alert.alert('App Version', 'tripCircle v1.0.0 (Exact Paise Precision)')}
          >
            <Text style={styles.optionText}>ℹ️ About tripCircle</Text>
            <Text style={styles.arrow}>➔</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  name: {
    ...THEME.typography.h2,
    marginTop: 10,
  },
  email: {
    ...THEME.typography.bodySmall,
    marginTop: 2,
  },
  phone: {
    ...THEME.typography.bodySmall,
    marginTop: 2,
  },
  statBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.divider,
    width: '100%',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  statLabel: {
    ...THEME.typography.caption,
    marginTop: 2,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  arrow: {
    fontSize: 14,
    color: THEME.colors.textMuted,
  },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    Alert.alert('Log Out', 'Are you sure you want to log out of TripCircle?', [
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
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>My Profile</Text>

        {/* Profile Identity Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <MemberAvatar name={profile?.name || 'User'} avatarUrl={profile?.avatarUrl} size={80} />
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={THEME.colors.primary} />
            </View>
          </View>

          <Text style={styles.name}>{profile?.name}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          {profile?.phone ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.phone}>{profile?.phone}</Text>
            </View>
          ) : null}

          {/* Stats Bar */}
          <View style={styles.statBox}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile?.completedTripCount || 0}</Text>
              <Text style={styles.statLabel}>COMPLETED TRIPS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#00F5A0' }]}>0.00</Text>
              <Text style={styles.statLabel}>NET UNSETTLED</Text>
            </View>
          </View>
        </View>

        {/* App Options List */}
        <View style={styles.optionsCard}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => navigation.navigate('Invitations')}
            activeOpacity={0.7}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.optionIconBox, { backgroundColor: '#F0FDFA' }]}>
                <Ionicons name="mail-outline" size={20} color={THEME.colors.primary} />
              </View>
              <Text style={styles.optionText}>Trip Invitations</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => Alert.alert('Payment QR', 'Your payment QR code can be uploaded in trip payment workflows to receive direct settlements via UPI.')}
            activeOpacity={0.7}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.optionIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="qr-code-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.optionText}>Payment QR Code</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, styles.lastOptionRow]}
            onPress={() =>
              Alert.alert(
                'About TripCircle',
                'TripCircle v1.0.0\nExact Paise Integer Accounting\nImmutable Audit Ledger & Settlement Engine'
              )
            }
            activeOpacity={0.7}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.optionIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="information-circle-outline" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.optionText}>About TripCircle</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={THEME.colors.debt} style={{ marginRight: 6 }} />
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
    paddingBottom: THEME.spacing.xxl,
  },
  headerTitle: {
    ...THEME.typography.h1,
    marginBottom: THEME.spacing.md,
  },
  profileCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: THEME.spacing.sm,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  name: {
    ...THEME.typography.h2,
    marginTop: 4,
  },
  email: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  phone: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
  },
  statBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: THEME.colors.darkCanvas,
    borderRadius: THEME.borderRadius.lg,
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionsCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    paddingHorizontal: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.lg,
    ...THEME.shadows.sm,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  lastOptionRow: {
    borderBottomWidth: 0,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.debtBg,
    borderWidth: 1,
    borderColor: THEME.colors.debtBorder,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: THEME.colors.debt,
    fontWeight: '700',
    fontSize: 15,
  },
});

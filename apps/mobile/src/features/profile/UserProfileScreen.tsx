import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { clearTokens } from '../../storage/secureStore';
import { LocalDatabase } from '../../storage/db';
import { checkForAppUpdate } from '../../services/updateService';
import { MemberAvatar } from '../../components/MemberAvatar';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { resolveMediaUrl } from '../../utils/media';
import { dialog } from '../../components/ui';
import { THEME } from '../../theme';

interface UserProfileScreenProps {
  navigation: any;
  user: any;
  onUpdateUser?: (updated: any) => void;
  onLogout: () => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  navigation,
  user,
  onUpdateUser,
  onLogout,
}) => {
  const [profile, setProfile] = useState<any>(user);
  const [loading, setLoading] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Sync with prop when parent updates
  useEffect(() => {
    if (user) {
      setProfile((prev: any) => ({ ...prev, ...user }));
    }
  }, [user]);

  const lastProfileFetchRef = React.useRef(0);

  const fetchMe = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastProfileFetchRef.current < 30000) {
      return;
    }
    try {
      const data = await apiRequest('/users/me');
      lastProfileFetchRef.current = Date.now();
      setProfile(data);
      onUpdateUser?.(data);
    } catch {
      // Keep local state
    }
  }, [onUpdateUser]);

  useEffect(() => {
    fetchMe(false);
    const unsubscribe = navigation.addListener('focus', () => fetchMe(false));
    return unsubscribe;
  }, [navigation, fetchMe]);

  const handleManualUpdateCheck = async () => {
    setCheckingUpdate(true);
    try {
      const update = await checkForAppUpdate();
      if (!update) {
        dialog.alert('TripCircle is Up to Date', 'You are running the latest version with the latest security and financial engine updates.', 'success');
      }
    } catch (err) {
      dialog.alert('Check Failed', (err as Error).message, 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await dialog.confirm('Log Out', 'Are you sure you want to log out of TripCircle?', {
      confirmText: 'Log Out',
      destructive: true,
    });
    if (confirmed) {
      await clearTokens();
      await LocalDatabase.clear();
      onLogout();
    }
  };

  if (loading && !profile) {
    return <LoadingIndicator message="Loading profile..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>My Profile</Text>

        {/* Profile Identity Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <MemberAvatar name={profile?.name || 'User'} avatarUrl={profile?.avatarUrl} size={84} />
            <TouchableOpacity
              style={styles.editAvatarBadge}
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.name}>{profile?.name}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          {profile?.phone ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.phone}>{profile?.phone}</Text>
            </View>
          ) : null}

          {/* Edit Profile Action Button */}
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={THEME.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.editProfileBtnText}>Edit Profile & Payment QR</Text>
          </TouchableOpacity>

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
            onPress={async () => {
              if (profile?.paymentQrUrl) {
                setQrModalVisible(true);
              } else {
                const setup = await dialog.confirm(
                  'No Payment QR Code',
                  'You have not configured a payment QR code yet. Would you like to set it up now?',
                  { confirmText: 'Set Up Now', cancelText: 'Later' }
                );
                if (setup) {
                  navigation.navigate('EditProfile');
                }
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.optionIconBox, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="qr-code-outline" size={20} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.optionText}>Payment QR Code</Text>
                <Text style={styles.optionSubtext}>
                  {profile?.paymentQrUrl ? 'Configured & Active' : 'Not configured'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={handleManualUpdateCheck}
            disabled={checkingUpdate}
            activeOpacity={0.7}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.optionIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="cloud-download-outline" size={20} color="#059669" />
              </View>
              <View>
                <Text style={styles.optionText}>Check for Updates</Text>
                <Text style={styles.optionSubtext}>TripCircle Release Channel</Text>
              </View>
            </View>
            {checkingUpdate ? (
              <ActivityIndicator size="small" color={THEME.colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, styles.lastOptionRow]}
            onPress={() =>
              dialog.alert(
                'About TripCircle',
                'TripCircle v1.0.0\n\nExact Paise Integer Accounting\nImmutable Audit Ledger & Settlement Engine\nLocal-first SQLite Sync Architecture',
                'info'
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

      {/* Payment QR Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.qrTitle}>Your Payment QR Code</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.qrSubtitle}>
              Trip members scan this code to pay you back directly.
            </Text>

            {resolveMediaUrl(profile?.paymentQrUrl) ? (
              <View style={styles.qrImageContainer}>
                <Image
                  source={{ uri: resolveMediaUrl(profile.paymentQrUrl)! }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.changeQrButton}
                onPress={() => {
                  setQrModalVisible(false);
                  navigation.navigate('EditProfile');
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.changeQrButtonText}>Change QR Code</Text>
              </TouchableOpacity>
            </View>
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
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: THEME.colors.primary,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: THEME.borderRadius.full,
    marginTop: 12,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.mint,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  optionSubtext: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  qrModalCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },
  qrTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  qrSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  qrImageContainer: {
    width: 240,
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  modalActionButtons: {
    width: '100%',
  },
  changeQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 12,
    width: '100%',
  },
  changeQrButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

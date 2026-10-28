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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, uploadImageFromUri } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { THEME } from '../../theme';

interface EditProfileScreenProps {
  route: any;
  navigation: any;
  user: any;
  onUpdateUser?: (updated: any) => void;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  navigation,
  user,
  onUpdateUser,
}) => {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Permission to access photos is needed to set your avatar.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setAvatarUri(res.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Photo Selection Failed', (err as Error).message);
    }
  };

  const pickQr = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Permission to access photos is needed to select your payment QR.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setQrUri(res.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('QR Selection Failed', (err as Error).message);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }

    try {
      setSaving(true);

      let finalAvatarUrl = user?.avatarUrl;
      let finalQrUrl = user?.paymentQrUrl;

      // 1. Upload new avatar if changed
      if (avatarUri) {
        const uploadedAvatar = await uploadImageFromUri(avatarUri, 'AVATAR');
        finalAvatarUrl = uploadedAvatar.publicUrl;
      }

      // 2. Upload new payment QR if changed
      if (qrUri) {
        const uploadedQr = await uploadImageFromUri(qrUri, 'PAYMENT_QR');
        finalQrUrl = uploadedQr.publicUrl;
      }

      // 3. Save profile mutations to backend
      const updatedProfile = await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          avatarUrl: finalAvatarUrl,
          paymentQrUrl: finalQrUrl,
        }),
      });

      if (onUpdateUser) {
        onUpdateUser(updatedProfile);
      }

      Alert.alert('Profile Saved', 'Your profile details have been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Failed to Update Profile', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveHeaderBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          ) : (
            <Text style={styles.saveHeaderText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <MemberAvatar name={name || user?.name || 'You'} avatarUrl={user?.avatarUrl} size={88} />
              )}
              <TouchableOpacity style={styles.cameraPill} onPress={pickAvatar} activeOpacity={0.85}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={pickAvatar} style={{ marginTop: 8 }}>
              <Text style={styles.changePhotoText}>Change Profile Photo</Text>
            </TouchableOpacity>
          </View>

          {/* User Information */}
          <Text style={styles.sectionHeader}>PERSONAL INFORMATION</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Your Name"
                placeholderTextColor={THEME.colors.textLight}
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor={THEME.colors.textLight}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.emailContainer}>
                <Text style={styles.emailReadonly}>{user?.email}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={11} color="#059669" style={{ marginRight: 3 }} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Payment QR Section */}
          <Text style={styles.sectionHeader}>PAYMENT SETTLEMENT QR CODE</Text>
          <View style={styles.card}>
            <Text style={styles.qrDescription}>
              This QR code is displayed to group members when they need to settle expenses and pay you directly.
            </Text>

            <View style={styles.qrDisplayContainer}>
              {qrUri ? (
                <View style={styles.qrPreviewWrapper}>
                  <Image source={{ uri: qrUri }} style={styles.qrPreviewImage} resizeMode="contain" />
                  <Text style={styles.newBadgeText}>New QR Selected (Unsaved)</Text>
                </View>
              ) : user?.paymentQrUrl ? (
                <View style={styles.qrPreviewWrapper}>
                  <Image source={{ uri: user.paymentQrUrl }} style={styles.qrPreviewImage} resizeMode="contain" />
                  <Text style={styles.activeBadgeText}>Current Active QR</Text>
                </View>
              ) : (
                <View style={styles.noQrBox}>
                  <Ionicons name="qr-code-outline" size={36} color={THEME.colors.textLight} />
                  <Text style={styles.noQrText}>No payment QR on file</Text>
                </View>
              )}

              <TouchableOpacity style={styles.replaceQrBtn} onPress={pickQr} activeOpacity={0.85}>
                <Ionicons name="cloud-upload-outline" size={16} color={THEME.colors.primaryDark} style={{ marginRight: 6 }} />
                <Text style={styles.replaceQrText}>
                  {user?.paymentQrUrl || qrUri ? 'Replace QR Image' : 'Upload Payment QR'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-sharp" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save Profile Changes</Text>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backBtn: {
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
  saveHeaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.sm,
  },
  saveHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: THEME.spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: THEME.colors.primary,
  },
  cameraPill: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: THEME.colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 8,
    marginTop: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  inputRow: {
    paddingVertical: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  textInput: {
    fontSize: 15,
    color: THEME.colors.textPrimary,
    fontWeight: '500',
    padding: 0,
  },
  rowDivider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: 4,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emailReadonly: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  qrDescription: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  qrDisplayContainer: {
    alignItems: 'center',
  },
  qrPreviewWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  qrPreviewImage: {
    width: 160,
    height: 160,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  noQrBox: {
    width: 160,
    height: 160,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: THEME.colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noQrText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 6,
  },
  replaceQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.md,
  },
  replaceQrText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  saveBtn: {
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
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

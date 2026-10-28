import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, uploadRegistrationQr } from '../../services/api';
import { THEME } from '../../theme';

interface RegisterScreenProps {
  navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Mandatory Payment QR state
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);

  const [loading, setLoading] = useState(false);

  const pickQrImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Photos permission is needed to select your personal payment QR code.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setQrUri(asset.uri);
        setUploadingQr(true);

        const mime = asset.mimeType || 'image/png';
        const uploadRes = await uploadRegistrationQr(asset.uri, mime);
        setQrToken(uploadRes.token);
      }
    } catch (err) {
      Alert.alert('QR Upload Failed', (err as Error).message);
      setQrUri(null);
      setQrToken(null);
    } finally {
      setUploadingQr(false);
    }
  };

  const removeQrImage = () => {
    setQrUri(null);
    setQrToken(null);
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your name, email, and password.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (!qrToken) {
      Alert.alert(
        'Payment QR Required',
        'TripCircle requires a valid payment QR code so trip members can settle debts with you seamlessly. Please select and upload your QR code.'
      );
      return;
    }

    try {
      setLoading(true);
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          paymentQrToken: qrToken,
          paymentQrUrl: qrUri || undefined,
        }),
        requiresAuth: false,
      });

      navigation.navigate('VerifyOtp', {
        email: email.trim().toLowerCase(),
        purpose: 'EMAIL_VERIFY',
      });
    } catch (err) {
      Alert.alert('Registration Failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Back Button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
          </TouchableOpacity>

          {/* Brand Header */}
          <View style={styles.brandSection}>
            <View style={styles.iconContainer}>
              <Image
                source={require('../../../assets/icon.png')}
                style={styles.brandIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitleTrip}>Trip</Text>
              <Text style={styles.brandTitleCircle}>Circle</Text>
            </View>
            <Text style={styles.brandSubtitle}>Create your account to start managing group trips</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Maya Sharma"
                  placeholderTextColor={THEME.colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@domain.com"
                  placeholderTextColor={THEME.colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number (Optional)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={THEME.colors.textLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="At least 8 characters"
                  placeholderTextColor={THEME.colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={THEME.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Mandatory Payment QR Section */}
            <View style={styles.qrSection}>
              <View style={styles.qrSectionHeader}>
                <Text style={styles.label}>Personal Payment QR Code *</Text>
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredBadgeText}>MANDATORY</Text>
                </View>
              </View>
              <Text style={styles.qrHelpText}>
                Upload your UPI, Google Pay, PhonePe, or Bank QR image so group members can settle directly with you.
              </Text>

              {qrUri ? (
                <View style={styles.qrPreviewCard}>
                  <Image source={{ uri: qrUri }} style={styles.qrThumbnail} resizeMode="contain" />
                  <View style={styles.qrPreviewDetails}>
                    <View style={styles.qrStatusRow}>
                      <Ionicons
                        name={qrToken ? 'checkmark-circle' : 'hourglass-outline'}
                        size={16}
                        color={qrToken ? THEME.colors.credit : THEME.colors.pending}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.qrStatusText, qrToken ? styles.qrStatusOk : styles.qrStatusWaiting]}>
                        {uploadingQr ? 'Uploading & verifying...' : qrToken ? 'Verified and ready' : 'Upload pending'}
                      </Text>
                    </View>
                    <View style={styles.qrActionsRow}>
                      <TouchableOpacity style={styles.qrActionBtn} onPress={pickQrImage} disabled={uploadingQr}>
                        <Ionicons name="refresh-outline" size={14} color={THEME.colors.primaryDark} style={{ marginRight: 4 }} />
                        <Text style={styles.qrActionText}>Replace</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.qrActionBtn, styles.qrRemoveBtn]} onPress={removeQrImage} disabled={uploadingQr}>
                        <Ionicons name="trash-outline" size={14} color={THEME.colors.debt} style={{ marginRight: 4 }} />
                        <Text style={[styles.qrActionText, { color: THEME.colors.debt }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.qrPickerBtn, uploadingQr && styles.qrPickerBtnDisabled]}
                  onPress={pickQrImage}
                  disabled={uploadingQr}
                  activeOpacity={0.8}
                >
                  {uploadingQr ? (
                    <ActivityIndicator color={THEME.colors.primary} />
                  ) : (
                    <>
                      <View style={styles.qrIconCircle}>
                        <Ionicons name="qr-code-outline" size={24} color={THEME.colors.primary} />
                      </View>
                      <View style={styles.qrPickerTextGroup}>
                        <Text style={styles.qrPickerTitle}>Select Payment QR Image</Text>
                        <Text style={styles.qrPickerSub}>PNG, JPEG, or WebP up to 5MB</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Register Action */}
            <TouchableOpacity
              style={[styles.registerButton, (loading || uploadingQr) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading || uploadingQr}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...THEME.shadows.sm,
  },
  brandIcon: {
    width: 44,
    height: 44,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleTrip: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandTitleCircle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...THEME.shadows.sm,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  eyeIcon: {
    padding: 4,
  },
  qrSection: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    marginTop: 4,
  },
  qrSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  requiredBadge: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qrHelpText: {
    fontSize: 12,
    color: '#0F766E',
    lineHeight: 16,
    marginBottom: 12,
  },
  qrPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#0D9488',
    borderRadius: 12,
    padding: 12,
  },
  qrPickerBtnDisabled: {
    opacity: 0.6,
  },
  qrIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  qrPickerTextGroup: {
    flex: 1,
  },
  qrPickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  qrPickerSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  qrPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  qrThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrPreviewDetails: {
    marginLeft: 12,
    flex: 1,
  },
  qrStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  qrStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  qrStatusOk: {
    color: THEME.colors.credit,
  },
  qrStatusWaiting: {
    color: THEME.colors.pending,
  },
  qrActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  qrActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qrRemoveBtn: {
    backgroundColor: '#FEE2E2',
  },
  qrActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  registerButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});

import React, { useState, useEffect } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { setTokens } from '../../storage/secureStore';
import { THEME } from '../../theme';

interface VerifyOtpScreenProps {
  route: any;
  navigation: any;
  onLoginSuccess?: (user: any) => void;
}

export const VerifyOtpScreen: React.FC<VerifyOtpScreenProps> = ({
  route,
  navigation,
  onLoginSuccess,
}) => {
  const { email, purpose } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Incomplete Code', 'Please enter all 6 digits of the verification code.');
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email,
          otp: otp.trim(),
          purpose,
        }),
        requiresAuth: false,
      });

      if (purpose === 'EMAIL_VERIFY' && data.accessToken) {
        await setTokens(data.accessToken, data.refreshToken);
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else if (purpose === 'PASSWORD_RESET') {
        navigation.navigate('ResetPassword', { email, otp: otp.trim() });
      }
    } catch (err) {
      Alert.alert('Verification Failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;

    try {
      setLoading(true);
      await apiRequest('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email, purpose }),
        requiresAuth: false,
      });
      setCooldown(60);
      Alert.alert('Code Sent', `A new verification code was delivered to ${email}.`);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={32} color={THEME.colors.primary} />
          </View>

          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit confirmation code to:
          </Text>
          <Text style={styles.emailText}>{email}</Text>

          <View style={styles.otpCard}>
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor={THEME.colors.textMuted}
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.verifyBtn, loading && styles.disabledBtn]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyBtnText}>Verify & Proceed</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendRow}>
              <Text style={styles.resendPrompt}>Didn't receive code? </Text>
              <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
                <Text style={[styles.resendLink, cooldown > 0 && styles.disabledLink]}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: THEME.spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: THEME.spacing.sm,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: THEME.spacing.xxl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: THEME.spacing.md,
  },
  title: {
    ...THEME.typography.h1,
    textAlign: 'center',
    marginBottom: THEME.spacing.xs,
  },
  subtitle: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  emailText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.primary,
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
  },
  otpCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.md,
  },
  otpInput: {
    backgroundColor: THEME.colors.inputBg,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.inputBorder,
    height: 56,
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: THEME.spacing.lg,
  },
  verifyBtn: {
    backgroundColor: THEME.colors.primary,
    height: 48,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.sm,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: THEME.spacing.md,
  },
  resendPrompt: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
  },
  resendLink: {
    ...THEME.typography.bodySmall,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  disabledLink: {
    color: THEME.colors.textMuted,
  },
});

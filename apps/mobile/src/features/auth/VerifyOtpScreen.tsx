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
} from 'react-native';
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
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter all 6 digits of the verification code');
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email,
          otp,
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
        navigation.navigate('ResetPassword', { email });
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
      await apiRequest('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email, purpose }),
        requiresAuth: false,
      });
      setCooldown(60);
      Alert.alert('OTP Resent', 'A new verification code has been dispatched.');
    } catch (err) {
      Alert.alert('Resend Failed', (err as Error).message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Verify Email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>

        <TextInput
          style={styles.otpInput}
          value={otp}
          onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="000000"
          placeholderTextColor="#CBD5E1"
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
        />

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={cooldown > 0}
        >
          <Text style={[styles.resendText, cooldown > 0 && styles.disabledText]}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    padding: THEME.spacing.lg,
  },
  content: {
    backgroundColor: THEME.colors.card,
    padding: THEME.spacing.xl,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
  },
  title: {
    ...THEME.typography.h1,
    marginBottom: 8,
  },
  subtitle: {
    ...THEME.typography.bodySmall,
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
  },
  emailHighlight: {
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  otpInput: {
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 10,
    width: '100%',
    paddingVertical: 14,
    color: THEME.colors.textPrimary,
    backgroundColor: '#F8FAFC',
    marginBottom: THEME.spacing.lg,
  },
  primaryBtn: {
    backgroundColor: THEME.colors.primary,
    width: '100%',
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendBtn: {
    padding: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  disabledText: {
    color: THEME.colors.textMuted,
  },
});

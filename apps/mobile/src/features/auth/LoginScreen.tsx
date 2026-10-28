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
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { setTokens } from '../../storage/secureStore';
import { THEME } from '../../theme';

interface LoginScreenProps {
  navigation: any;
  onLoginSuccess: (user: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
        requiresAuth: false,
      });

      await setTokens(data.accessToken, data.refreshToken);
      onLoginSuccess(data.user);
    } catch (err) {
      Alert.alert('Login Failed', (err as Error).message);
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
            <Text style={styles.brandSubtitle}>Exact group expenses & transparent settlement</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.welcomeSub}>Log in to access your shared trip ledgers</Text>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
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

            {/* Forgot Password Link */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Log In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Register Prompt */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New to TripCircle? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Create an account</Text>
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
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.xl,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: THEME.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.md,
  },
  brandIcon: {
    width: '100%',
    height: '100%',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleTrip: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTitleCircle: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: THEME.spacing.xs,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.md,
  },
  welcomeText: {
    ...THEME.typography.h2,
    color: THEME.colors.textPrimary,
  },
  welcomeSub: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    marginBottom: THEME.spacing.lg,
  },
  inputGroup: {
    marginBottom: THEME.spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.inputBg,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.inputBorder,
    paddingHorizontal: THEME.spacing.md,
    height: 48,
  },
  inputIcon: {
    marginRight: THEME.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: THEME.colors.textPrimary,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: THEME.spacing.xs,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: THEME.spacing.lg,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  primaryBtn: {
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
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: THEME.spacing.xl,
  },
  footerText: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
  },
  footerLink: {
    ...THEME.typography.bodySmall,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});

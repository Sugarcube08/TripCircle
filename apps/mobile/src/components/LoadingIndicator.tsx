import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { THEME } from '../theme';

interface LoadingProps {
  message?: string;
  dark?: boolean;
}

export const LoadingIndicator: React.FC<LoadingProps> = ({
  message = 'Loading TripCircle...',
  dark = false,
}) => {
  return (
    <View style={[styles.container, dark && styles.darkContainer]}>
      <View style={styles.brandBox}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <ActivityIndicator size="small" color={THEME.colors.primary} style={styles.spinner} />
      {message ? (
        <Text style={[styles.text, dark && styles.darkText]}>{message}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
    backgroundColor: THEME.colors.background,
  },
  darkContainer: {
    backgroundColor: THEME.colors.darkCanvas,
  },
  brandBox: {
    width: 64,
    height: 64,
    borderRadius: THEME.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.md,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  spinner: {
    marginVertical: THEME.spacing.xs,
  },
  text: {
    ...THEME.typography.bodySmallMedium,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  darkText: {
    color: THEME.colors.textMuted,
  },
});

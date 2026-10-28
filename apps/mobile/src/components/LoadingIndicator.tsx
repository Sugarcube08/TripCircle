import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { THEME } from '../theme';

interface LoadingProps {
  message?: string;
}

export const LoadingIndicator: React.FC<LoadingProps> = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={THEME.colors.primary} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  text: {
    ...THEME.typography.bodySmall,
    marginTop: THEME.spacing.sm,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDateTime } from '../utils/formatters';

interface OfflineBannerProps {
  isOffline: boolean;
  lastSyncTimestamp?: string | null;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOffline,
  lastSyncTimestamp,
}) => {
  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        ⚠️ Offline Mode — Showing cached data.
        {lastSyncTimestamp ? ` Last synced: ${formatDateTime(lastSyncTimestamp)}` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

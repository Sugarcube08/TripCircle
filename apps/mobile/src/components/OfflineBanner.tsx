import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTime } from '../utils/formatters';
import { THEME } from '../theme';

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
      <Ionicons name="cloud-offline-outline" size={16} color="#B45309" style={styles.icon} />
      <Text style={styles.text}>
        Offline Mode — Showing cached data.
        {lastSyncTimestamp ? ` Last synced ${formatDateTime(lastSyncTimestamp)}` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingVertical: 9,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { apiRequest } from '../../services/api';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { formatDateTime } from '../../utils/formatters';
import { THEME } from '../../theme';

interface TripActivityScreenProps {
  route?: any;
  navigation?: any;
}

export const TripActivityScreen: React.FC<TripActivityScreenProps> = ({ route }) => {
  const tripId = route?.params?.tripId;
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActivity = useCallback(async () => {
    try {
      if (tripId) {
        const data = await apiRequest(`/trips/${tripId}/activity`);
        setActivities(data || []);
      } else {
        // App-wide notifications & activity
        const data = await apiRequest('/notifications');
        setActivities(data || []);
      }
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivity();
  };

  if (loading && !refreshing) {
    return <LoadingIndicator message="Loading activity timeline..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Activity Timeline</Text>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.activityCard}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.time}>{formatDateTime(item.timestamp || item.createdAt)}</Text>
            </View>
            <Text style={styles.description}>{item.description || item.body}</Text>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No Activity Recorded"
            message="Recent expenses, payments, and trip events will appear here."
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  headerTitle: {
    ...THEME.typography.h1,
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  list: {
    padding: THEME.spacing.md,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  description: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
});

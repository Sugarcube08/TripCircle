import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../../services/api';
import { LocalDatabase } from '../../storage/db';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { formatDateTime } from '../../utils/formatters';
import { THEME } from '../../theme';

interface TripActivityScreenProps {
  route?: any;
  navigation?: any;
}

function getActivityIcon(type?: string, title?: string): { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  const t = ((type || '') + ' ' + (title || '')).toLowerCase();
  if (t.includes('payment') || t.includes('confirm') || t.includes('transfer')) {
    return { icon: 'arrow-forward-circle-outline', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
  }
  if (t.includes('expense') || t.includes('spent') || t.includes('paid')) {
    return { icon: 'receipt-outline', color: '#00F5A0', bg: 'rgba(0, 245, 160, 0.15)' };
  }
  if (t.includes('member') || t.includes('invite') || t.includes('join')) {
    return { icon: 'person-add-outline', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
  }
  if (t.includes('dispute') || t.includes('reject')) {
    return { icon: 'alert-circle-outline', color: '#F87171', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  if (t.includes('close') || t.includes('lock')) {
    return { icon: 'lock-closed-outline', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' };
  }
  return { icon: 'notifications-outline', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' };
}

export const TripActivityScreen: React.FC<TripActivityScreenProps> = ({ route, navigation }) => {
  const tripId = route?.params?.tripId;
  const cachedNotifications = useMemo(() => (!tripId ? LocalDatabase.getNotifications() : []), [tripId]);
  const [activities, setActivities] = useState<any[]>(cachedNotifications);
  const [loading, setLoading] = useState(!tripId ? cachedNotifications.length === 0 : true);
  const [refreshing, setRefreshing] = useState(false);

  const canGoBack = navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack();

  const loadActivity = useCallback(async () => {
    try {
      if (tripId) {
        const data = await apiRequest(`/trips/${tripId}/activity`);
        setActivities(data || []);
      } else {
        const data = await apiRequest('/notifications');
        const notifs = data || [];
        setActivities(notifs);
        LocalDatabase.saveNotifications(notifs);
      }
    } catch {
      if (!tripId) {
        setActivities(LocalDatabase.getNotifications());
      } else {
        setActivities([]);
      }
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
    <SafeAreaView style={styles.container} edges={canGoBack ? ['top', 'bottom', 'left', 'right'] : ['top']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      {/* Header */}
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 10 }} />
        )}
        <Text style={styles.headerTitle}>{tripId ? 'Trip Activity' : 'Activity & Alerts'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const act = getActivityIcon(item.type, item.title);

          return (
            <View style={styles.activityCard}>
              <View style={[styles.iconCircle, { backgroundColor: act.bg }]}>
                <Ionicons name={act.icon} size={20} color={act.color} />
              </View>

              <View style={styles.activityBody}>
                <View style={styles.headerRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.time}>{formatDateTime(item.timestamp || item.createdAt)}</Text>
                </View>
                <Text style={styles.description}>{item.description || item.body}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No Activity Recorded"
            message="Recent expenses, payments, and trip events will appear here in chronological order."
            icon="notifications-off-outline"
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
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
  list: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  activityCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...THEME.shadows.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  activityBody: {
    flex: 1,
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

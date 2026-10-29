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
import { ActivityRouter, notifyUnreadCountChanged } from '../../services/activityRouter';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { formatDateTime } from '../../utils/formatters';
import { THEME, getActivityConfig } from '../../theme';

interface TripActivityScreenProps {
  route?: any;
  navigation?: any;
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
        notifyUnreadCountChanged();
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
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadActivity();
    });
    return unsubscribe;
  }, [navigation, loadActivity]);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivity();
  };

  const unreadCount = useMemo(() => {
    if (tripId) return 0;
    return activities.filter((a) => !a.isRead).length;
  }, [activities, tripId]);

  const handleMarkAllRead = async () => {
    ActivityRouter.markAsReadLocally();
    setActivities((prev) => prev.map((a) => ({ ...a, isRead: true })));
    apiRequest('/notifications', {
      method: 'POST',
      body: JSON.stringify({}),
    }).catch(() => {});
  };

  const handlePressActivity = async (item: any) => {
    // Route through centralized router service
    await ActivityRouter.routeActivity(item, navigation);
    // Optimistically update list read state
    setActivities((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, isRead: true } : a))
    );
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
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.headerTitle}>{tripId ? 'Trip Activity' : 'Activity & Alerts'}</Text>

        {!tripId && unreadCount > 0 ? (
          <TouchableOpacity
            style={styles.markAllReadBtn}
            onPress={handleMarkAllRead}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.markAllReadText}>Read All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const act = getActivityConfig(item.type, item.title);
          const isUnread = !item.isRead && !tripId;

          return (
            <TouchableOpacity
              style={[styles.activityCard, isUnread && styles.unreadCard]}
              activeOpacity={0.75}
              onPress={() => handlePressActivity(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.description || item.body}`}
            >
              <View style={[styles.iconCircle, { backgroundColor: act.bg, borderColor: act.border }]}>
                <Ionicons name={act.icon} size={20} color={act.color} />
              </View>

              <View style={styles.activityBody}>
                <View style={styles.headerRow}>
                  <View style={styles.titleContainer}>
                    {isUnread && <View style={styles.unreadDot} />}
                    <Text
                      style={[styles.title, isUnread && styles.unreadTitle]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  </View>
                  <Text style={styles.time}>{formatDateTime(item.timestamp || item.createdAt)}</Text>
                </View>
                <Text style={[styles.description, isUnread && styles.unreadDescription]}>
                  {item.description || item.body}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={16}
                color={isUnread ? THEME.colors.primary : THEME.colors.textMuted}
                style={styles.chevron}
              />
            </TouchableOpacity>
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
  markAllReadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surfaceSubtle,
  },
  markAllReadText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
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
    alignItems: 'center',
    minHeight: 64,
    ...THEME.shadows.sm,
  },
  unreadCard: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.primaryDark,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityBody: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: THEME.colors.primary,
    marginRight: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#FFFFFF',
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
  unreadDescription: {
    color: THEME.colors.textPrimary,
  },
  chevron: {
    marginLeft: 8,
  },
});

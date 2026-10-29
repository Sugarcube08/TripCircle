import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../features/trips/HomeScreen';
import { TripActivityScreen } from '../features/trips/TripActivityScreen';
import { UserProfileScreen } from '../features/profile/UserProfileScreen';
import { subscribeToUnreadCount, ActivityRouter } from '../services/activityRouter';
import { THEME } from '../theme';

const Tab = createBottomTabNavigator();

interface MainTabProps {
  user: any;
  setUser?: (u: any) => void;
  onLogout: () => void;
}

export const MainTabNavigator: React.FC<MainTabProps> = ({ user, setUser, onLogout }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Subscribe to reactive unread count changes from ActivityRouter
    const unsubscribe = subscribeToUnreadCount((count) => {
      setUnreadCount(count);
    });

    // Also poll server unread count on startup
    ActivityRouter.refreshUnreadCount().then((serverCount) => {
      setUnreadCount(serverCount);
    });

    return unsubscribe;
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.colors.mint,
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarStyle: {
          backgroundColor: THEME.colors.background,
          borderTopColor: THEME.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          ...THEME.shadows.sm,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: -2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        options={{
          tabBarLabel: 'Trips',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'compass' : 'compass-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      >
        {(props) => <HomeScreen {...props} user={user} />}
      </Tab.Screen>

      <Tab.Screen
        name="ActivityTab"
        component={TripActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: THEME.colors.primary,
            color: '#0B0F19',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: Platform.OS === 'ios' ? 18 : 17,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <UserProfileScreen
            {...props}
            user={user}
            onUpdateUser={setUser}
            onLogout={onLogout}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

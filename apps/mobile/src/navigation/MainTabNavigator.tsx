import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../features/trips/HomeScreen';
import { TripActivityScreen } from '../features/trips/TripActivityScreen';
import { UserProfileScreen } from '../features/profile/UserProfileScreen';
import { THEME } from '../theme';

const Tab = createBottomTabNavigator();

interface MainTabProps {
  user: any;
  onLogout: () => void;
}

export const MainTabNavigator: React.FC<MainTabProps> = ({ user, onLogout }) => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: THEME.colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
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
        {(props) => <UserProfileScreen {...props} user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

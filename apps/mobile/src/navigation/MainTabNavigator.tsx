import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
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
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        options={{
          tabBarLabel: 'Trips',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✈️</Text>,
        }}
      >
        {(props) => <HomeScreen {...props} user={user} />}
      </Tab.Screen>

      <Tab.Screen
        name="ActivityTab"
        component={TripActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔔</Text>,
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: 'Me',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text>,
        }}
      >
        {(props) => <UserProfileScreen {...props} user={user} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

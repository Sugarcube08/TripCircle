import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getAccessToken, clearTokens } from './src/storage/secureStore';
import { apiRequest } from './src/services/api';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoadingIndicator } from './src/components/LoadingIndicator';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    async function checkExistingAuth() {
      try {
        const token = await getAccessToken();
        if (token) {
          const profile = await apiRequest('/users/me');
          setUser(profile);
        }
      } catch {
        await clearTokens();
        setUser(null);
      } finally {
        setInitializing(false);
      }
    }
    checkExistingAuth();
  }, []);

  if (initializing) {
    return <LoadingIndicator message="Initializing TripCircle..." />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator user={user} setUser={setUser} />
    </SafeAreaProvider>
  );
}

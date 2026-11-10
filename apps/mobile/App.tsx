import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getAccessToken, getRefreshToken, clearTokens, onSessionExpired } from './src/storage/secureStore';
import { apiRequest } from './src/services/api';
import { LocalDatabase } from './src/storage/db';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoadingIndicator } from './src/components/LoadingIndicator';
import { UpdatePromptModal } from './src/components/UpdatePromptModal';
import { DialogProvider } from './src/context/DialogContext';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    async function checkExistingAuth() {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          getAccessToken(),
          getRefreshToken(),
          LocalDatabase.init(),
        ]);

        if (accessToken || refreshToken) {
          const profile = await apiRequest('/users/me');
          setUser(profile);
          await LocalDatabase.init(profile.id);
        }
      } catch {
        await clearTokens();
        LocalDatabase.resetMemory();
        setUser(null);
      } finally {
        setInitializing(false);
      }
    }

    // Reactively return to login screen whenever refresh tokens are revoked or sessions expire
    const unsubscribe = onSessionExpired(() => {
      setUser(null);
    });

    checkExistingAuth();

    return () => {
      unsubscribe();
    };
  }, []);

  if (initializing) {
    return <LoadingIndicator message="Initializing TripCircle..." />;
  }

  return (
    <SafeAreaProvider>
      <DialogProvider>
        <StatusBar style="light" />
        <RootNavigator user={user} setUser={setUser} />
        <UpdatePromptModal />
      </DialogProvider>
    </SafeAreaProvider>
  );
}

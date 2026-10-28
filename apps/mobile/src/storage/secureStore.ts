import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'tc_access_token';
const REFRESH_TOKEN_KEY = 'tc_refresh_token';

let memoryTokens: { access: string | null; refresh: string | null } = {
  access: null,
  refresh: null,
};

export async function setTokens(accessToken: string, refreshToken: string) {
  memoryTokens.access = accessToken;
  memoryTokens.refresh = refreshToken;

  if (Platform.OS !== 'web') {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch (e) {
      console.warn('SecureStore write failed:', e);
    }
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (memoryTokens.access) return memoryTokens.access;
  if (Platform.OS !== 'web') {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export async function getRefreshToken(): Promise<string | null> {
  if (memoryTokens.refresh) return memoryTokens.refresh;
  if (Platform.OS !== 'web') {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export async function clearTokens() {
  memoryTokens.access = null;
  memoryTokens.refresh = null;

  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (e) {
      console.warn('SecureStore clear failed:', e);
    }
  }
}

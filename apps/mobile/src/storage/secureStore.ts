import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'tc_access_token';
const REFRESH_TOKEN_KEY = 'tc_refresh_token';

let memoryTokens: { access: string | null; refresh: string | null } = {
  access: null,
  refresh: null,
};

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function notifySessionExpired() {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch (e) {
      console.warn('Session expired listener error:', e);
    }
  }
}

export function isTokenExpiringSoon(token: string, bufferSeconds = 30): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const globalBuffer = typeof globalThis !== 'undefined' ? (globalThis as any).Buffer : undefined;
    const decodedStr =
      typeof atob === 'function'
        ? atob(base64)
        : globalBuffer
        ? globalBuffer.from(base64, 'base64').toString('utf8')
        : '';
    if (!decodedStr) return false;
    const payload = JSON.parse(decodedStr);
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now() + bufferSeconds * 1000;
  } catch {
    return false;
  }
}

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

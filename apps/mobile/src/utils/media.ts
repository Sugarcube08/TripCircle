import { getApiBaseUrl } from '../services/api';

/**
 * Resolves any relative media URL (such as /api/v1/files/...) to an absolute URL
 * using the configured API base URL from .env (EXPO_PUBLIC_API_URL).
 * Returns undefined if no URL is provided.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // If already an absolute HTTP/HTTPS URL, data URL, or file/content URI
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  // Prepend API Base URL
  try {
    const baseUrl = getApiBaseUrl();
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${baseUrl}${cleanPath}`;
  } catch {
    return undefined;
  }
}

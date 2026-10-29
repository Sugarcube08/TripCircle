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

  // Local device URIs (from camera/gallery or local cache)
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  let baseUrl = '';
  let origin = '';
  try {
    baseUrl = getApiBaseUrl(); // e.g. "https://api-eta-liard-50.vercel.app/api/v1"
    const parsed = new URL(baseUrl);
    origin = parsed.origin; // e.g. "https://api-eta-liard-50.vercel.app"
  } catch {
    baseUrl = '';
    origin = '';
  }

  // Handle loopback URLs created in local dev environments (localhost / 127.0.0.1 / 10.0.2.2)
  if (
    origin &&
    (trimmed.includes('localhost:') ||
      trimmed.includes('127.0.0.1:') ||
      trimmed.includes('10.0.2.2:'))
  ) {
    try {
      const parsedUrl = new URL(trimmed);
      return `${origin}${parsedUrl.pathname}${parsedUrl.search}`;
    } catch {
      const pathOnly = trimmed.replace(/^https?:\/\/[^/]+/, '');
      return `${origin}${pathOnly}`;
    }
  }

  // Absolute external URLs (e.g. S3 / R2 direct public URLs or DiceBear)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Relative URLs
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // If path already starts with /api/, append to origin to avoid /api/v1/api/v1 duplication
  if (cleanPath.startsWith('/api/') && origin) {
    return `${origin}${cleanPath}`;
  }

  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}${cleanPath}`;
  }

  return cleanPath;
}

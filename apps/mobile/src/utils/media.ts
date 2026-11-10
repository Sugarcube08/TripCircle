import { getApiBaseUrl } from '../services/api';

/**
 * Resolves any media URL or storage key to an absolute, network-accessible URL
 * using the configured API base URL (EXPO_PUBLIC_API_URL).
 * Returns undefined if no URL is provided.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // 1. Local device URIs (from camera/gallery or local cache)
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

  // 2. Raw storage key stored directly in DB (e.g. "users/.../avatars/...", "temp/registration-qr/...")
  if (
    trimmed.startsWith('users/') ||
    trimmed.startsWith('trips/') ||
    trimmed.startsWith('temp/') ||
    trimmed.startsWith('uploads/')
  ) {
    return origin
      ? `${origin}/api/v1/files/${trimmed}`
      : `/api/v1/files/${trimmed}`;
  }

  // 3. Re-anchor ANY TripCircle file URL to the currently configured mobile API origin.
  // This guarantees that URLs saved during local development (localhost:3000, 10.0.2.2, 127.0.0.1, LAN IPs)
  // or older deployment URLs are transparently routed through the active backend server.
  if (origin && (trimmed.includes('/api/v1/files/') || trimmed.includes('/files/'))) {
    try {
      const parsedUrl = new URL(trimmed);
      return `${origin}${parsedUrl.pathname}${parsedUrl.search}`;
    } catch {
      const filesIdx = trimmed.indexOf('/api/v1/files/');
      if (filesIdx !== -1) {
        return `${origin}${trimmed.substring(filesIdx)}`;
      }
      const shortFilesIdx = trimmed.indexOf('/files/');
      if (shortFilesIdx !== -1) {
        return `${origin}/api/v1${trimmed.substring(shortFilesIdx)}`;
      }
    }
  }

  // 4. Absolute external URLs (e.g. S3 / R2 direct public URLs or external CDNs)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 5. Relative URLs
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (cleanPath.startsWith('/api/') && origin) {
    return `${origin}${cleanPath}`;
  }

  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}${cleanPath}`;
  }

  return cleanPath;
}

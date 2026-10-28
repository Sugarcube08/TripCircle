import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../storage/secureStore';

/**
 * Resolves the API base URL strictly from environment variables.
 * The API endpoint is NEVER hardcoded and is always fetched from .env.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!envUrl || envUrl.trim() === '') {
    throw new Error(
      '[TripCircle Configuration Error] EXPO_PUBLIC_API_URL is missing. Please set EXPO_PUBLIC_API_URL in your apps/mobile/.env file.'
    );
  }
  return envUrl.trim().replace(/\/$/, '');
}

let isOnline = true;

export function setOnlineStatus(status: boolean) {
  isOnline = status;
}

export function getOnlineStatus(): boolean {
  return isOnline;
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const requiresAuth = options.requiresAuth !== false;
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token refresh on 401 Unauthorized
    if (response.status === 401 && requiresAuth) {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            await setTokens(refreshData.data.accessToken, refreshData.data.refreshToken);

            // Retry original request with new token
            headers['Authorization'] = `Bearer ${refreshData.data.accessToken}`;
            response = await fetch(url, {
              ...options,
              headers,
            });
          } else {
            await clearTokens();
          }
        } catch {
          await clearTokens();
        }
      }
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error?.message || data.error || data.message || 'Request failed';
        throw new Error(errorMsg);
      }
      return data.data !== undefined ? data.data : data;
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    return response as unknown as T;
  } catch (error) {
    // If network fetch fails, set offline
    if (
      (error as Error).message.includes('Network request failed') ||
      (error as Error).message.includes('Failed to fetch')
    ) {
      isOnline = false;
    }
    throw error;
  }
}

/**
 * Pre-registration payment QR upload (unauthenticated server-mediated endpoint).
 * Returns temporary HMAC-signed token, storage key, and preview URL.
 */
export async function uploadRegistrationQr(
  imageUri: string,
  mimeType = 'image/png'
): Promise<{ token: string; storageKey: string; publicUrl: string }> {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();

  const fileName = imageUri.split('/').pop() || 'payment-qr.png';
  formData.append('file', {
    uri: imageUri,
    name: fileName,
    type: mimeType,
  } as any);

  const response = await fetch(`${baseUrl}/auth/register-qr`, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.error?.message || data.error || 'Failed to upload QR code';
    throw new Error(errorMsg);
  }

  return data.data || data;
}

/**
 * Upload binary file to Cloudflare R2 using presigned URL workflow
 */
export async function uploadFileToR2(params: {
  blob: Blob;
  fileName: string;
  mimeType: string;
  category: 'AVATAR' | 'PAYMENT_QR' | 'EXPENSE_RECEIPT' | 'PAYMENT_RECEIPT' | 'TRIP_COVER';
  tripId?: string;
  expenseId?: string;
  paymentId?: string;
}) {
  // 1. Request presigned upload URL from API
  const presignResult = await apiRequest<{
    uploadUrl: string;
    storageKey: string;
    fileId: string;
  }>('/files/upload', {
    method: 'POST',
    body: JSON.stringify({
      category: params.category,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.blob.size,
      tripId: params.tripId,
      expenseId: params.expenseId,
      paymentId: params.paymentId,
    }),
  });

  // 2. Upload file directly to Cloudflare R2 via HTTP PUT
  const uploadRes = await fetch(presignResult.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': params.mimeType,
    },
    body: params.blob,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload file to storage: ${uploadRes.statusText}`);
  }

  // 3. Confirm upload with API to record metadata
  const metadata = await apiRequest('/files/confirm', {
    method: 'POST',
    body: JSON.stringify({
      storageKey: presignResult.storageKey,
      originalName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.blob.size,
      tripId: params.tripId,
    }),
  });

  return metadata;
}

/**
 * Upload image from local file URI (for Avatar, Payment QR, Receipt)
 */
export async function uploadImageFromUri(
  imageUri: string,
  category: 'AVATAR' | 'PAYMENT_QR' | 'EXPENSE_RECEIPT' | 'PAYMENT_RECEIPT' | 'TRIP_COVER',
  options: { tripId?: string; mimeType?: string } = {}
) {
  const mimeType = options.mimeType || 'image/jpeg';
  const fileName = imageUri.split('/').pop() || `${category.toLowerCase()}.jpg`;

  const response = await fetch(imageUri);
  const blob = await response.blob();

  return uploadFileToR2({
    blob,
    fileName,
    mimeType,
    category,
    tripId: options.tripId,
  });
}

/**
 * Retrieve short-lived authorized download URL for private files
 */
export async function getAuthorizedFileUrl(storageKey: string): Promise<string> {
  const result = await apiRequest<{ downloadUrl: string }>(
    `/files/${encodeURIComponent(storageKey)}?format=url`
  );
  return result.downloadUrl;
}

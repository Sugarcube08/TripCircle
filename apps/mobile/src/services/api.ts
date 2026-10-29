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

/**
 * Parses raw server error details into a structured field -> error message array map.
 */
export function parseFieldErrors(details: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!details) return result;

  if (Array.isArray(details)) {
    for (const item of details) {
      if (typeof item === 'object' && item !== null) {
        const path = (item as any).path || (item as any).field;
        const msg = (item as any).message;
        if (typeof path === 'string' && typeof msg === 'string') {
          if (!result[path]) result[path] = [];
          result[path].push(msg);
        }
      }
    }
  } else if (typeof details === 'object' && details !== null) {
    for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
      if (typeof v === 'string') {
        result[k] = [v];
      } else if (Array.isArray(v)) {
        result[k] = v.filter((item): item is string => typeof item === 'string');
      }
    }
  }
  return result;
}

/**
 * Rich API Error with HTTP status, correlation ID, timeout flags, field-level validation errors, and network classification.
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  isTimeout: boolean;
  isNetworkError: boolean;
  correlationId?: string;
  details?: unknown;
  fieldErrors: Record<string, string[]>;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      isTimeout?: boolean;
      isNetworkError?: boolean;
      correlationId?: string;
      details?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status || 0;
    this.code = options.code;
    this.isTimeout = options.isTimeout || false;
    this.isNetworkError = options.isNetworkError || false;
    this.correlationId = options.correlationId;
    this.details = options.details;
    this.fieldErrors = parseFieldErrors(options.details);
  }

  get isValidationError(): boolean {
    return this.status === 422 || this.code === 'VALIDATION_ERROR' || Object.keys(this.fieldErrors).length > 0;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }

  get isForbidden(): boolean {
    return this.status === 403 || this.code === 'FORBIDDEN';
  }

  get isConflict(): boolean {
    return this.status === 409 || this.code === 'CONFLICT';
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === 'NOT_FOUND';
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  getFieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  hasFieldError(field: string): boolean {
    return !!this.fieldErrors[field] && this.fieldErrors[field].length > 0;
  }

  formatUserMessage(): string {
    if (this.isTimeout) {
      return 'Request timed out. Please check your network connection and try again.';
    }
    if (this.isNetworkError) {
      return 'Network unavailable. Please check your internet connection.';
    }
    if (this.isAuthError) {
      return 'Your session has expired. Please log in again.';
    }
    if (this.isConflict) {
      return this.message || 'This item was modified by someone else. Please refresh and try again.';
    }
    const fieldKeys = Object.keys(this.fieldErrors);
    if (fieldKeys.length > 0) {
      const messages = fieldKeys.map((k) => this.fieldErrors[k].join(', '));
      return messages.join('\n');
    }
    return this.message || 'An unexpected error occurred.';
  }
}

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  timeoutMs?: number;
  correlationId?: string;
  _isRetry?: boolean;
}

// Single active token refresh promise shared across all concurrent 401 requests
let activeRefreshPromise: Promise<string | null> | null = null;

async function requestSharedTokenRefresh(baseUrl: string): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await clearTokens();
        return null;
      }

      const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshRes.ok) {
        await clearTokens();
        return null;
      }

      const refreshData = await refreshRes.json();
      const newAccess = refreshData.data?.accessToken || refreshData.accessToken;
      const newRefresh = refreshData.data?.refreshToken || refreshData.refreshToken;

      if (newAccess && newRefresh) {
        await setTokens(newAccess, newRefresh);
        return newAccess;
      }

      await clearTokens();
      return null;
    } catch {
      await clearTokens();
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

/**
 * Executes an HTTP request with automatic timeout, cancellation support,
 * request correlation, coordinated token refresh, and normalized error responses.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const requiresAuth = options.requiresAuth !== false;
  const timeoutMs = options.timeoutMs ?? 15000; // 15s default timeout
  const correlationId =
    options.correlationId || `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': correlationId,
    ...(options.headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Setup abort controller for timeout and caller cancellation
  const controller = new AbortController();
  let timedOut = false;
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Link caller-provided signal if present
  let removeCallerListener: (() => void) | null = null;
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutTimer);
      controller.abort();
    } else {
      const onCallerAbort = () => controller.abort();
      options.signal.addEventListener('abort', onCallerAbort);
      removeCallerListener = () => options.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  const startTime = Date.now();

  try {
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      signal: controller.signal,
    };
    // remove custom internal flags from native fetch options
    delete (fetchOptions as any).requiresAuth;
    delete (fetchOptions as any).timeoutMs;
    delete (fetchOptions as any).correlationId;
    delete (fetchOptions as any)._isRetry;

    let response = await fetch(url, fetchOptions);
    clearTimeout(timeoutTimer);
    if (removeCallerListener) removeCallerListener();

    // 1. Handle token refresh on 401 Unauthorized (only if this is not already a retry)
    if (response.status === 401 && requiresAuth && !options._isRetry) {
      const newToken = await requestSharedTokenRefresh(baseUrl);
      if (newToken) {
        // Retry original request exactly once with fresh token
        return apiRequest<T>(endpoint, {
          ...options,
          _isRetry: true,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      } else {
        throw new ApiError('Session expired. Please log in again.', {
          status: 401,
          code: 'UNAUTHORIZED',
          correlationId,
        });
      }
    }

    setOnlineStatus(true);

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error?.message || data.error || data.message || `Request failed (${response.status})`;
        const errorCode = data.error?.code || data.code;
        throw new ApiError(errorMsg, {
          status: response.status,
          code: errorCode,
          correlationId,
          details: data.error?.details || data.details,
        });
      }
      return data.data !== undefined ? data.data : data;
    }

    if (!response.ok) {
      throw new ApiError(`HTTP error ${response.status}: ${response.statusText}`, {
        status: response.status,
        correlationId,
      });
    }

    return response as unknown as T;
  } catch (error: any) {
    clearTimeout(timeoutTimer);
    if (removeCallerListener) removeCallerListener();

    if (error instanceof ApiError) {
      throw error;
    }

    if (timedOut) {
      throw new ApiError(`Request timed out after ${timeoutMs}ms for ${endpoint}`, {
        isTimeout: true,
        correlationId,
      });
    }

    if (controller.signal.aborted && !timedOut) {
      throw new ApiError('Request was cancelled', {
        code: 'ABORTED',
        correlationId,
      });
    }

    const errorMsg = error?.message || 'Network request failed';
    const isNetwork =
      errorMsg.includes('Network request failed') ||
      errorMsg.includes('Failed to fetch') ||
      errorMsg.includes('NetworkError');

    if (isNetwork) {
      setOnlineStatus(false);
    }

    throw new ApiError(errorMsg, {
      isNetworkError: isNetwork,
      correlationId,
    });
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
  const correlationId = `qr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const fileName = imageUri.split('/').pop() || 'payment-qr.png';
  formData.append('file', {
    uri: imageUri,
    name: fileName,
    type: mimeType,
  } as any);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000); // 45s timeout

  try {
    const response = await fetch(`${baseUrl}/auth/register-qr`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-Request-ID': correlationId,
      },
    });

    clearTimeout(timer);
    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data.error?.message || data.error || 'Failed to upload QR code';
      throw new ApiError(errorMsg, { status: response.status, correlationId });
    }

    return data.data || data;
  } catch (err: any) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new ApiError('QR upload timed out after 45 seconds', { isTimeout: true, correlationId });
    }
    throw err;
  }
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
 * Uses high-performance native multipart form upload directly to TripCircle API.
 */
export async function uploadImageFromUri(
  imageUri: string,
  category: 'AVATAR' | 'PAYMENT_QR' | 'EXPENSE_RECEIPT' | 'PAYMENT_RECEIPT' | 'TRIP_COVER',
  options: { tripId?: string; expenseId?: string; paymentId?: string; mimeType?: string; timeoutMs?: number } = {}
): Promise<{ id: string; storageKey: string; publicUrl: string; fileName: string }> {
  const baseUrl = getApiBaseUrl();
  const token = await getAccessToken();
  const formData = new FormData();
  const mimeType = options.mimeType || 'image/jpeg';
  const fileName = imageUri.split('/').pop() || `${category.toLowerCase()}.jpg`;
  const timeoutMs = options.timeoutMs ?? 60000; // 60s timeout for media uploads
  const correlationId = `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  formData.append('file', {
    uri: imageUri,
    name: fileName,
    type: mimeType,
  } as any);
  formData.append('category', category);
  if (options.tripId) {
    formData.append('tripId', options.tripId);
  }
  if (options.expenseId) {
    formData.append('expenseId', options.expenseId);
  }
  if (options.paymentId) {
    formData.append('paymentId', options.paymentId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/files/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/json',
        'X-Request-ID': correlationId,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data.error?.message || data.error || 'Failed to upload image';
      throw new ApiError(errorMsg, {
        status: response.status,
        correlationId,
        code: data.error?.code || data.code,
        details: data.error?.details || data.details,
      });
    }

    return data.data || data;
  } catch (err: any) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new ApiError(`Image upload timed out after ${timeoutMs / 1000} seconds`, {
        isTimeout: true,
        correlationId,
      });
    }
    throw err;
  }
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

/**
 * Add an offline/dummy member to a trip
 */
export async function addDummyMember(
  tripId: string,
  input: { name: string; email?: string | null; phone?: string | null }
) {
  return apiRequest(`/trips/${tripId}/members/dummy`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Replace an offline/dummy member with a registered TripCircle user
 */
export async function replaceDummyMember(
  tripId: string,
  memberId: string,
  input: { registeredUserId: string }
) {
  return apiRequest(`/trips/${tripId}/members/${memberId}/replace`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Search registered TripCircle users by name or email
 */
export async function searchRegisteredUsers(query: string) {
  return apiRequest<Array<{ id: string; name: string; email: string; avatarUrl?: string | null }>>(
    `/users/search?q=${encodeURIComponent(query)}`
  );
}

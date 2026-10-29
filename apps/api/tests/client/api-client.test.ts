import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, ApiError, setOnlineStatus, getOnlineStatus } from '../../../mobile/src/services/api';
import * as secureStore from '../../../mobile/src/storage/secureStore';

describe('API Client Resilience, Timeouts & Concurrency Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000/api/v1';
    setOnlineStatus(true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('1. Successfully executes a request and returns parsed JSON data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { trips: [{ id: 'trip-1', name: 'Goa Trip' }] } }),
    });

    const result = await apiRequest('/trips', { requiresAuth: false });
    expect(result).toEqual({ trips: [{ id: 'trip-1', name: 'Goa Trip' }] });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getOnlineStatus()).toBe(true);
  });

  it('2. Extracts server error message and throws structured ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: { message: 'Invalid split allocations: sum must equal total', code: 'INVALID_SPLIT' },
      }),
    });

    await expect(apiRequest('/trips/1/expenses', { requiresAuth: false })).rejects.toThrow(
      'Invalid split allocations: sum must equal total'
    );
  });

  it('3. Throws descriptive ApiError when receiving non-JSON HTTP errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: { get: () => 'text/html' },
    });

    await expect(apiRequest('/health', { requiresAuth: false })).rejects.toThrow('HTTP error 502: Bad Gateway');
  });

  it('4. Handles request timeout and aborts cleanly', async () => {
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expect(apiRequest('/slow-endpoint', { requiresAuth: false, timeoutMs: 50 })).rejects.toThrow(
      /timed out after 50ms/
    );
  });

  it('5. Supports caller-provided cancellation signal', async () => {
    const callerController = new AbortController();

    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    setTimeout(() => callerController.abort(), 20);

    await expect(
      apiRequest('/cancellable', { requiresAuth: false, signal: callerController.signal, timeoutMs: 5000 })
    ).rejects.toThrow('Request was cancelled');
  });

  it('6. Coordinated token refresh: Deduplicates concurrent 401s into a single refresh call and retries', async () => {
    await secureStore.setTokens('initial-expired-token', 'valid-refresh-token');

    let refreshCallCount = 0;
    let initialRequestCount = 0;
    let retriedRequestCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            data: { accessToken: 'new-valid-access-token', refreshToken: 'new-valid-refresh-token' },
          }),
        };
      }

      // Check auth header
      const authHeader = options.headers?.['Authorization'];
      if (authHeader === 'Bearer initial-expired-token') {
        initialRequestCount++;
        return {
          ok: false,
          status: 401,
          headers: { get: () => 'application/json' },
          json: async () => ({ error: { message: 'Token expired', code: 'UNAUTHORIZED' } }),
        };
      }

      if (authHeader === 'Bearer new-valid-access-token') {
        retriedRequestCount++;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: { endpoint: url } }),
        };
      }

      return {
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'Bad Request' }),
      };
    });

    // Fire 3 simultaneous authenticated requests that will all encounter 401
    const [res1, res2, res3] = await Promise.all([
      apiRequest('/endpoint-1', { requiresAuth: true }),
      apiRequest('/endpoint-2', { requiresAuth: true }),
      apiRequest('/endpoint-3', { requiresAuth: true }),
    ]);

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();
    expect(res3).toBeDefined();

    // Verify token refresh was invoked EXACTLY ONCE
    expect(refreshCallCount).toBe(1);
    expect(initialRequestCount).toBe(3);
    expect(retriedRequestCount).toBe(3);
  });

  it('7. Handles failed token refresh without infinite retry loop and clears tokens', async () => {
    await secureStore.setTokens('initial-expired-token', 'revoked-refresh-token');

    let refreshCallCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return {
          ok: false,
          status: 401,
          headers: { get: () => 'application/json' },
          json: async () => ({ error: { message: 'Refresh token invalid' } }),
        };
      }

      return {
        ok: false,
        status: 401,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: { message: 'Token expired' } }),
      };
    });

    await expect(apiRequest('/secure-data', { requiresAuth: true })).rejects.toThrow(
      'Session expired. Please log in again.'
    );

    // Refresh should be called once, then fail cleanly
    expect(refreshCallCount).toBe(1);
  });

  it('8. Flags offline status on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network request failed'));

    await expect(apiRequest('/ping', { requiresAuth: false })).rejects.toThrow('Network request failed');
    expect(getOnlineStatus()).toBe(false);
  });
});

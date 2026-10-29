import { describe, it, expect } from 'vitest';
import { ApiError, parseFieldErrors } from '../../../../apps/mobile/src/services/api';

describe('P0: Structured Validation Error Handling & Mapping', () => {
  it('parses array-based validation error details from the server', () => {
    const serverDetails = [
      { path: 'name', message: 'Trip name is required' },
      { path: 'allocations', message: 'The sum of all member shares must exactly equal the total expense amount in paise' },
    ];

    const error = new ApiError('Validation failed', {
      status: 422,
      code: 'VALIDATION_ERROR',
      details: serverDetails,
      correlationId: 'tc-test-req-123',
    });

    expect(error.status).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.isValidationError).toBe(true);
    expect(error.correlationId).toBe('tc-test-req-123');

    expect(error.hasFieldError('name')).toBe(true);
    expect(error.getFieldError('name')).toBe('Trip name is required');
    expect(error.hasFieldError('allocations')).toBe(true);
    expect(error.getFieldError('allocations')).toContain('The sum of all member shares');
    expect(error.hasFieldError('missingField')).toBe(false);
    expect(error.getFieldError('missingField')).toBeUndefined();
  });

  it('parses object-based field error maps', () => {
    const objectDetails = {
      email: 'Invalid email address',
      amountPaise: ['Amount must be at least 1 paisa', 'Share mismatch'],
    };

    const error = new ApiError('Invalid request parameters', {
      status: 400,
      code: 'BAD_REQUEST',
      details: objectDetails,
    });

    expect(error.hasFieldError('email')).toBe(true);
    expect(error.getFieldError('email')).toBe('Invalid email address');
    expect(error.hasFieldError('amountPaise')).toBe(true);
    expect(error.getFieldError('amountPaise')).toBe('Amount must be at least 1 paisa');
  });

  it('formats actionable user message using field error details', () => {
    const error = new ApiError('Validation failed', {
      status: 422,
      code: 'VALIDATION_ERROR',
      details: [
        { path: 'allocations', message: 'Shares sum to ₹90.00 but expense is ₹100.00.' },
      ],
    });

    const userMessage = error.formatUserMessage();
    expect(userMessage).toBe('Shares sum to ₹90.00 but expense is ₹100.00.');
  });

  it('distinguishes error classifications accurately', () => {
    const authErr = new ApiError('Session expired', { status: 401, code: 'UNAUTHORIZED' });
    expect(authErr.isAuthError).toBe(true);
    expect(authErr.isValidationError).toBe(false);
    expect(authErr.formatUserMessage()).toContain('session has expired');

    const forbiddenErr = new ApiError('Permission denied', { status: 403, code: 'FORBIDDEN' });
    expect(forbiddenErr.isForbidden).toBe(true);

    const conflictErr = new ApiError('Version conflict', { status: 409, code: 'CONFLICT' });
    expect(conflictErr.isConflict).toBe(true);
    expect(conflictErr.formatUserMessage()).toBe('Version conflict');

    const timeoutErr = new ApiError('Timeout', { isTimeout: true });
    expect(timeoutErr.isTimeout).toBe(true);
    expect(timeoutErr.formatUserMessage()).toContain('Request timed out');

    const netErr = new ApiError('Network error', { isNetworkError: true });
    expect(netErr.isNetworkError).toBe(true);
    expect(netErr.formatUserMessage()).toContain('Network unavailable');

    const serverErr = new ApiError('Database crashed', { status: 500 });
    expect(serverErr.isServerError).toBe(true);
  });

  it('safely handles malformed, undefined, or unexpected error responses without throwing', () => {
    expect(() => parseFieldErrors(null)).not.toThrow();
    expect(() => parseFieldErrors(undefined)).not.toThrow();
    expect(() => parseFieldErrors('plain string')).not.toThrow();
    expect(() => parseFieldErrors(12345)).not.toThrow();
    expect(() => parseFieldErrors([null, undefined, 42, { strange: true }])).not.toThrow();

    const emptyError = new ApiError('Generic error', { details: null });
    expect(emptyError.fieldErrors).toEqual({});
    expect(emptyError.formatUserMessage()).toBe('Generic error');
  });
});

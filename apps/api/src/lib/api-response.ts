import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function successResponse<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status, headers }
  );
}

export function errorResponse(
  message: string,
  statusCode = 400,
  errorCode = 'BAD_REQUEST',
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
      },
    },
    { status: statusCode }
  );
}

export function handleApiError(err: unknown) {
  console.error('API Error:', err);

  if (err instanceof ZodError) {
    return errorResponse(
      'Validation failed',
      422,
      'VALIDATION_ERROR',
      err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }))
    );
  }

  if (err instanceof Error) {
    if (err.message.includes('Unauthorized') || err.message.includes('token')) {
      return errorResponse(err.message, 401, 'UNAUTHORIZED');
    }
    if (err.message.includes('Forbidden') || err.message.includes('permission')) {
      return errorResponse(err.message, 403, 'FORBIDDEN');
    }
    if (err.message.includes('not found')) {
      return errorResponse(err.message, 404, 'NOT_FOUND');
    }
    if (err.message.includes('Conflict') || err.message.includes('version')) {
      return errorResponse(err.message, 409, 'CONFLICT');
    }
    return errorResponse(err.message, 400, 'BAD_REQUEST');
  }

  return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
}

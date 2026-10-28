import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'tripCircle API',
      version: '1.0.0',
      description: 'Collaborative trip expense tracking and exact paise settlement API',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'tripCircle REST API v1',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      '/health': {
        get: {
          summary: 'Service health check and database connectivity',
          responses: { 200: { description: 'Healthy' }, 503: { description: 'Unhealthy' } },
        },
      },
      '/auth/register': {
        post: {
          summary: 'User registration with OTP dispatch',
          requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { 201: { description: 'User registered' } },
        },
      },
      '/auth/verify-otp': {
        post: {
          summary: 'Verify email or reset password OTP',
          responses: { 200: { description: 'OTP verified' } },
        },
      },
      '/auth/login': {
        post: {
          summary: 'User email and password login',
          responses: { 200: { description: 'Authenticated with access & refresh tokens' } },
        },
      },
      '/auth/refresh': {
        post: {
          summary: 'Rotate refresh token and issue new access token',
          responses: { 200: { description: 'Tokens refreshed' } },
        },
      },
      '/auth/logout': {
        post: {
          summary: 'Revoke refresh token and invalidate session',
          responses: { 200: { description: 'Logged out' } },
        },
      },
      '/trips': {
        get: { summary: 'List user trips with net position' },
        post: { summary: 'Create new trip' },
      },
      '/trips/{id}': {
        get: { summary: 'Get trip details with members and balance' },
        put: { summary: 'Update trip settings' },
      },
      '/trips/{id}/expenses': {
        get: { summary: 'List trip expenses' },
        post: { summary: 'Add expense (equal or unequal split)' },
      },
      '/trips/{id}/expenses/{expenseId}': {
        get: { summary: 'Get expense detail and revisions' },
        put: { summary: 'Edit expense with optimistic concurrency' },
      },
      '/trips/{id}/payments': {
        get: { summary: 'List payments' },
        post: { summary: 'Record pending payment' },
      },
      '/trips/{id}/payments/{paymentId}/confirm': {
        post: { summary: 'Receiver confirms payment' },
      },
      '/trips/{id}/payments/{paymentId}/dispute': {
        post: { summary: 'Receiver disputes payment' },
      },
      '/trips/{id}/settlement': {
        get: { summary: 'Get settlement plan, net balances and transfers' },
      },
      '/trips/{id}/settlement/discounts': {
        post: { summary: 'Propose explicit settlement discount' },
      },
      '/trips/{id}/reports/export': {
        post: { summary: 'Export individual or trip PDF / Excel report' },
      },
      '/sync': {
        post: { summary: 'Incremental synchronization endpoint' },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}

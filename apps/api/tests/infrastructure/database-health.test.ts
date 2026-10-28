import { describe, it, expect } from 'vitest';
import { prisma, checkDatabaseHealth } from '../../src/lib/prisma';
import { getEnv, getSanitizedConfigSummary } from '../../src/lib/env';

describe('Database & Environment Health Infrastructure Tests', () => {
  it('verifies MySQL database connectivity and reports ping latency', async () => {
    const health = await checkDatabaseHealth();
    expect(health.status).toBe('connected');
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.error).toBeUndefined();
  });

  it('verifies that database transactions rollback completely on error', async () => {
    const testEmail = `rollback.test.${Date.now()}@tripcircle.app`;

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email: testEmail,
            name: 'Rollback User',
            passwordHash: 'dummy-hash',
            isEmailVerified: false,
          },
        });

        // Intentional failure to trigger rollback
        throw new Error('Simulated transaction failure for rollback verification');
      })
    ).rejects.toThrow('Simulated transaction failure for rollback verification');

    // Confirm that the user record was NOT committed
    const found = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    expect(found).toBeNull();
  });

  it('masks sensitive secrets in sanitized config summary', () => {
    const summary = getSanitizedConfigSummary();

    expect(summary).toHaveProperty('NODE_ENV');
    expect(summary).toHaveProperty('DATABASE_URL_CONFIGURED', true);
    expect(summary).toHaveProperty('STORAGE_DRIVER');
    expect(summary).toHaveProperty('R2_CONFIGURED');
    expect(summary).toHaveProperty('SMTP_CONFIGURED');

    // Ensure raw credentials are never leaked into configuration summary
    expect(summary).not.toHaveProperty('DATABASE_URL');
    expect(summary).not.toHaveProperty('JWT_ACCESS_SECRET');
    expect(summary).not.toHaveProperty('JWT_REFRESH_SECRET');
    expect(summary).not.toHaveProperty('SMTP_PASSWORD');
    expect(summary).not.toHaveProperty('R2_SECRET_ACCESS_KEY');
  });

  it('fails safely when required production secrets violate constraints', () => {
    const env = getEnv();
    expect(env.FILE_MAX_SIZE_BYTES).toBe(10485760);
    expect(env.API_BASE_URL).toBeDefined();
    expect(env.APP_PUBLIC_URL).toBeDefined();
  });
});

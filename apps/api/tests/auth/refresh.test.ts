import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { AuthService } from '../../src/modules/auth/service';
import { generateAccessToken, generateRefreshToken } from '../../src/lib/jwt';
import crypto from 'crypto';

describe('API Auth Refresh Architecture & Concurrency Grace Period Tests', () => {
  let testUser: any;
  let testSession: any;
  let initialRefreshToken: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        email: `refresh_test_${timestamp}@tripcircle.test`,
        passwordHash: 'dummy_hash',
        name: 'Refresh Tester',
        paymentQrUrl: 'https://example.com/qr.png',
        isEmailVerified: true,
      },
    });

    initialRefreshToken = generateRefreshToken({ userId: testUser.id, email: testUser.email });
    const initialHash = crypto.createHash('sha256').update(initialRefreshToken).digest('hex');

    testSession = await prisma.session.create({
      data: {
        userId: testUser.id,
        refreshTokenHash: initialHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    if (testUser) {
      await prisma.session.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  it('1. Successfully rotates refresh token and returns fresh tokens and user profile', async () => {
    const result = await AuthService.refresh(initialRefreshToken);

    expect(result).toBeDefined();
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(initialRefreshToken);
    expect(result.user).toBeDefined();
    expect(result.user.id).toBe(testUser.id);
    expect(result.user.email).toBe(testUser.email);
    expect(result.user.name).toBe('Refresh Tester');

    // Verify database session was updated with the new hash
    const updatedSession = await prisma.session.findUnique({ where: { id: testSession.id } });
    const newHash = crypto.createHash('sha256').update(result.refreshToken).digest('hex');
    expect(updatedSession?.refreshTokenHash).toBe(newHash);
  });

  it('2. Tolerates concurrent race conditions: Old refresh token within 30s grace window returns valid tokens without error', async () => {
    // Calling refresh with the original initialRefreshToken that was just rotated
    const graceResult = await AuthService.refresh(initialRefreshToken);

    expect(graceResult).toBeDefined();
    expect(graceResult.accessToken).toBeDefined();
    expect(graceResult.refreshToken).toBeDefined();
    expect(graceResult.user.id).toBe(testUser.id);
  });

  it('3. Rejects invalid or expired JWT refresh token', async () => {
    await expect(AuthService.refresh('not-a-valid-jwt-token')).rejects.toThrow(
      'Unauthorized: Invalid or expired refresh token'
    );
  });

  it('4. Rejects refresh after session is logged out / revoked', async () => {
    const newRefreshToken = generateRefreshToken({ userId: testUser.id, email: testUser.email });
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    const tempSession = await prisma.session.create({
      data: {
        userId: testUser.id,
        refreshTokenHash: newHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Log out with token
    await AuthService.logout(newRefreshToken);

    // Verify session revoked in database
    const revoked = await prisma.session.findUnique({ where: { id: tempSession.id } });
    expect(revoked?.revokedAt).not.toBeNull();

    // Refresh should fail
    await expect(AuthService.refresh(newRefreshToken)).rejects.toThrow('Unauthorized');
  });
});

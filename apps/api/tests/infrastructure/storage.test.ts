import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateStorageKey, getSafeExtension } from '../../src/infrastructure/storage/key-generator';
import { StorageService, extractStorageKey } from '../../src/infrastructure/storage';
import { prisma } from '../../src/lib/prisma';
import { getEnv } from '../../src/lib/env';

describe('Cloudflare R2 & Storage Infrastructure Tests', () => {
  describe('Logical Object-Key Generation', () => {
    it('generates predictable user avatar key pattern: users/{userId}/avatars/{uuid}.{ext}', () => {
      const { storageKey, fileId } = generateStorageKey({
        category: 'AVATAR',
        userId: 'user-123',
        originalName: 'photo.png',
        mimeType: 'image/png',
      });

      expect(storageKey).toBe(`users/user-123/avatars/${fileId}.png`);
      expect(fileId).toBeDefined();
    });

    it('generates payment QR key pattern: users/{userId}/payment-qr/{uuid}.{ext}', () => {
      const { storageKey, fileId } = generateStorageKey({
        category: 'PAYMENT_QR',
        userId: 'user-456',
        originalName: 'upi_qr.jpg',
        mimeType: 'image/jpeg',
      });

      expect(storageKey).toBe(`users/user-456/payment-qr/${fileId}.jpg`);
    });

    it('generates expense receipt key pattern: trips/{tripId}/expenses/{expenseId}/{uuid}.{ext}', () => {
      const { storageKey, fileId } = generateStorageKey({
        category: 'EXPENSE_RECEIPT',
        userId: 'user-123',
        tripId: 'trip-999',
        expenseId: 'exp-555',
        originalName: 'bill.pdf',
        mimeType: 'application/pdf',
      });

      expect(storageKey).toBe(`trips/trip-999/expenses/exp-555/${fileId}.pdf`);
    });

    it('generates payment receipt key pattern: trips/{tripId}/payments/{paymentId}/{uuid}.{ext}', () => {
      const { storageKey, fileId } = generateStorageKey({
        category: 'PAYMENT_RECEIPT',
        userId: 'user-123',
        tripId: 'trip-999',
        paymentId: 'pay-777',
        originalName: 'screenshot.webp',
        mimeType: 'image/webp',
      });

      expect(storageKey).toBe(`trips/trip-999/payments/pay-777/${fileId}.webp`);
    });

    it('generates trip cover key pattern: trips/{tripId}/covers/{uuid}.{ext}', () => {
      const { storageKey, fileId } = generateStorageKey({
        category: 'TRIP_COVER',
        userId: 'user-123',
        tripId: 'trip-999',
        originalName: 'goa_beach.jpg',
        mimeType: 'image/jpeg',
      });

      expect(storageKey).toBe(`trips/trip-999/covers/${fileId}.jpg`);
    });

    it('gracefully handles draft trip cover when tripId is not yet created', () => {
      const { storageKey, fileId } = generateStorageKey({
        category: 'TRIP_COVER',
        userId: 'user-123',
        originalName: 'draft_cover.jpg',
        mimeType: 'image/jpeg',
      });

      expect(storageKey).toBe(`users/user-123/covers/${fileId}.jpg`);
    });

    it('prevents path traversal attempts in identifiers', () => {
      const { storageKey } = generateStorageKey({
        category: 'AVATAR',
        userId: '../../etc/passwd',
        originalName: 'avatar.png',
        mimeType: 'image/png',
      });

      expect(storageKey).not.toContain('..');
      expect(storageKey).toContain('users/etcpasswd/avatars/');
    });
  });

  describe('Safe File Extension Resolver', () => {
    it('maps known image and document MIME types to canonical extensions', () => {
      expect(getSafeExtension('test.jpeg', 'image/jpeg')).toBe('.jpg');
      expect(getSafeExtension('test.png', 'image/png')).toBe('.png');
      expect(getSafeExtension('test.webp', 'image/webp')).toBe('.webp');
      expect(getSafeExtension('test.pdf', 'application/pdf')).toBe('.pdf');
    });

    it('falls back to safe binary for unknown types', () => {
      expect(getSafeExtension('malicious.exe', 'application/x-msdownload')).toBe('.bin');
    });
  });

  describe('Storage Validation & Limits', () => {
    it('rejects unsupported file MIME types', async () => {
      await expect(
        StorageService.requestUpload({
          userId: 'user-test',
          category: 'AVATAR',
          fileName: 'script.sh',
          mimeType: 'application/x-sh',
        })
      ).rejects.toThrow(/not allowed/i);
    });

    it('rejects files exceeding the 10MB size limit', async () => {
      const oversized = 11 * 1024 * 1024; // 11MB
      await expect(
        StorageService.requestUpload({
          userId: 'user-test',
          category: 'AVATAR',
          fileName: 'huge.png',
          mimeType: 'image/png',
          sizeBytes: oversized,
        })
      ).rejects.toThrow(/exceeds maximum allowed size/i);
    });

    it('generates valid presigned upload response for allowed MIME type within size limit', async () => {
      const result = await StorageService.requestUpload({
        userId: 'user-test',
        category: 'AVATAR',
        fileName: 'profile.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024 * 1024,
      });

      expect(result.fileId).toBeDefined();
      expect(result.uploadUrl).toBeDefined();
      expect(result.storageKey).toContain('users/user-test/avatars/');
      expect(result.expiresInSeconds).toBe(300);
    });
  });

  describe('Storage Key Extraction from Public URLs', () => {
    it('extracts canonical storage keys from relative and absolute API URLs', () => {
      const key1 = extractStorageKey('/api/v1/files/users%2Fuser-1%2Favatars%2Fimg1.jpg');
      expect(key1).toBe('users/user-1/avatars/img1.jpg');

      const key2 = extractStorageKey('https://api-eta-liard-50.vercel.app/api/v1/files/trips%2Ftrip-1%2Fcovers%2Fcover.png?token=secret');
      expect(key2).toBe('trips/trip-1/covers/cover.png');

      const key3 = extractStorageKey('users/user-2/payment-qr/qr.jpg');
      expect(key3).toBe('users/user-2/payment-qr/qr.jpg');
    });

    it('safely returns null for external URLs like DiceBear and Unsplash', () => {
      expect(extractStorageKey('https://api.dicebear.com/7.x/avataaars/svg?seed=John')).toBeNull();
      expect(extractStorageKey('https://images.unsplash.com/photo-1512343879784?w=600')).toBeNull();
      expect(extractStorageKey(null)).toBeNull();
      expect(extractStorageKey('')).toBeNull();
    });
  });

  describe('Context-Aware Media Replacement and Automatic Orphan Cleanup', () => {
    let testUser: any;
    let testTrip: any;

    beforeAll(async () => {
      testUser = await prisma.user.create({
        data: {
          email: `media-test-${Date.now()}@tripcircle.test`,
          name: 'Media Test User',
          passwordHash: 'dummyhash123',
          isEmailVerified: true,
        },
      });

      testTrip = await prisma.trip.create({
        data: {
          name: 'Media Test Trip',
          creatorId: testUser.id,
          startDate: new Date(),
        },
      });
    });

    afterAll(async () => {
      if (testTrip?.id) {
        await prisma.fileMetadata.deleteMany({ where: { tripId: testTrip.id } }).catch(() => {});
        await prisma.trip.delete({ where: { id: testTrip.id } }).catch(() => {});
      }
      if (testUser?.id) {
        await prisma.fileMetadata.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('removes previous avatar when a new avatar is uploaded for the same user', async () => {
      // Upload initial avatar
      const firstAvatar = await StorageService.uploadDirect({
        userId: testUser.id,
        buffer: Buffer.from('fake-avatar-1-bytes'),
        originalName: 'avatar1.png',
        mimeType: 'image/png',
        category: 'AVATAR',
      });

      expect(firstAvatar.storageKey).toContain(`users/${testUser.id}/avatars/`);

      // Verify first file exists in DB
      const record1 = await prisma.fileMetadata.findFirst({
        where: { storageKey: firstAvatar.storageKey },
      });
      expect(record1).not.toBeNull();

      // Upload second avatar for the same user (same context)
      const secondAvatar = await StorageService.uploadDirect({
        userId: testUser.id,
        buffer: Buffer.from('fake-avatar-2-bytes'),
        originalName: 'avatar2.png',
        mimeType: 'image/png',
        category: 'AVATAR',
      });

      expect(secondAvatar.storageKey).toContain(`users/${testUser.id}/avatars/`);
      expect(secondAvatar.storageKey).not.toBe(firstAvatar.storageKey);

      // Verify first file was removed from DB
      const record1After = await prisma.fileMetadata.findFirst({
        where: { storageKey: firstAvatar.storageKey },
      });
      expect(record1After).toBeNull();

      // Verify second file exists in DB
      const record2 = await prisma.fileMetadata.findFirst({
        where: { storageKey: secondAvatar.storageKey },
      });
      expect(record2).not.toBeNull();

      // Clean up second avatar after test
      await StorageService.deleteMediaByUrl(secondAvatar.storageKey);
    });

    it('removes previous trip cover when a new cover is uploaded for the same trip', async () => {
      // Upload initial trip cover
      const firstCover = await StorageService.uploadDirect({
        userId: testUser.id,
        tripId: testTrip.id,
        buffer: Buffer.from('fake-cover-1-bytes'),
        originalName: 'cover1.jpg',
        mimeType: 'image/jpeg',
        category: 'TRIP_COVER',
      });

      expect(firstCover.storageKey).toContain(`trips/${testTrip.id}/covers/`);

      // Upload second cover for the same trip
      const secondCover = await StorageService.uploadDirect({
        userId: testUser.id,
        tripId: testTrip.id,
        buffer: Buffer.from('fake-cover-2-bytes'),
        originalName: 'cover2.jpg',
        mimeType: 'image/jpeg',
        category: 'TRIP_COVER',
      });

      // Verify previous cover was removed
      const oldCoverRecord = await prisma.fileMetadata.findFirst({
        where: { storageKey: firstCover.storageKey },
      });
      expect(oldCoverRecord).toBeNull();

      // Verify new cover is recorded
      const newCoverRecord = await prisma.fileMetadata.findFirst({
        where: { storageKey: secondCover.storageKey },
      });
      expect(newCoverRecord).not.toBeNull();

      // Clean up after test
      await StorageService.deleteMediaByUrl(secondCover.storageKey);
    });
  });
});

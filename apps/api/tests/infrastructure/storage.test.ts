import { describe, it, expect } from 'vitest';
import { generateStorageKey, getSafeExtension } from '../../src/infrastructure/storage/key-generator';
import { StorageService } from '../../src/infrastructure/storage';
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
});

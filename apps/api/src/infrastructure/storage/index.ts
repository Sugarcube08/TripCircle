import { getEnv } from '../../lib/env';
import { prisma } from '../../lib/prisma';
import { IStorageDriver, PresignedUploadRequest, PresignedUploadResponse, FileCategory } from './types';
import { R2StorageService } from './r2.service';
import { LocalStorageService } from './local.service';
import { generateStorageKey } from './key-generator';

export * from './types';
export * from './key-generator';

export interface DeleteMediaContextParams {
  category: FileCategory;
  userId?: string;
  tripId?: string;
  expenseId?: string;
  paymentId?: string;
  excludeStorageKey?: string;
}

/**
 * Extracts canonical storage key from a public URL or relative file path.
 * Returns null if the URL is an external resource (e.g. Unsplash, DiceBear).
 */
export function extractStorageKey(urlOrKey?: string | null): string | null {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  const trimmed = urlOrKey.trim();
  if (!trimmed) return null;

  // 1. Matches /api/v1/files/<key> or full host URL containing /api/v1/files/<key>
  const filesPathIdx = trimmed.indexOf('/api/v1/files/');
  if (filesPathIdx !== -1) {
    const keyPart = trimmed.substring(filesPathIdx + '/api/v1/files/'.length).split('?')[0];
    try {
      return decodeURIComponent(keyPart);
    } catch {
      return keyPart;
    }
  }

  // 2. Matches absolute storage direct URLs (e.g. R2 public bucket URLs)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.replace(/^\/+/, '');
      const decoded = decodeURIComponent(pathname);
      if (
        decoded.startsWith('users/') ||
        decoded.startsWith('trips/') ||
        decoded.startsWith('uploads/') ||
        decoded.startsWith('temp/')
      ) {
        return decoded;
      }
    } catch {
      // not a parseable URL
    }
    return null;
  }

  // 3. Already a storage key
  if (
    trimmed.startsWith('users/') ||
    trimmed.startsWith('trips/') ||
    trimmed.startsWith('uploads/') ||
    trimmed.startsWith('temp/')
  ) {
    return trimmed.split('?')[0];
  }

  return null;
}

let driverInstance: IStorageDriver | null = null;

export function getStorageDriver(): IStorageDriver {
  if (driverInstance) return driverInstance;

  const env = getEnv();
  if (env.STORAGE_DRIVER === 'r2') {
    driverInstance = new R2StorageService();
  } else {
    driverInstance = new LocalStorageService();
  }

  return driverInstance;
}

export class StorageService {
  /**
   * Authorize and prepare an upload session.
   * Validates size, allowed MIME types, and trip permissions before issuing presigned URL.
   */
  static async requestUpload(params: {
    userId: string;
    category: FileCategory;
    fileName: string;
    mimeType: string;
    sizeBytes?: number;
    tripId?: string;
    expenseId?: string;
    paymentId?: string;
  }): Promise<PresignedUploadResponse> {
    const env = getEnv();

    // 1. Validate MIME type
    const allowedMimes = env.FILE_ALLOWED_MIME_TYPES.split(',').map((m) => m.trim().toLowerCase());
    if (!allowedMimes.includes(params.mimeType.toLowerCase())) {
      throw new Error(
        `File type "${params.mimeType}" is not allowed. Supported types: ${allowedMimes.join(', ')}`
      );
    }

    // 2. Validate declared size
    if (params.sizeBytes && params.sizeBytes > env.FILE_MAX_SIZE_BYTES) {
      throw new Error(
        `File size (${(params.sizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size of ${(env.FILE_MAX_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB`
      );
    }

    // 3. Authorization check if tripId is supplied
    if (params.tripId) {
      const membership = await prisma.tripMember.findFirst({
        where: {
          tripId: params.tripId,
          userId: params.userId,
          status: 'ACTIVE',
        },
      });

      if (!membership) {
        throw new Error('Forbidden: You are not an active member of this trip');
      }
    }

    // 4. Generate presigned URL via configured driver
    const driver = getStorageDriver();
    const result = await driver.createPresignedUploadUrl({
      category: params.category,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      userId: params.userId,
      tripId: params.tripId,
      expenseId: params.expenseId,
      paymentId: params.paymentId,
    });

    return result;
  }

  /**
   * Verifies that the client uploaded the file to storage,
   * validates actual size/type where possible, and records metadata in MySQL.
   */
  static async confirmUpload(params: {
    userId: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes?: number;
    tripId?: string;
  }) {
    const driver = getStorageDriver();

    // 1. Verify object actually exists in storage
    const verification = await driver.verifyObject(params.storageKey);
    if (!verification.exists) {
      throw new Error('Upload verification failed: file does not exist in storage');
    }

    const actualSize = verification.sizeBytes ?? params.sizeBytes ?? 0;
    const env = getEnv();

    if (actualSize > env.FILE_MAX_SIZE_BYTES) {
      // Cleanup oversized object
      await driver.deleteObject(params.storageKey);
      throw new Error('Uploaded file exceeds maximum permitted size');
    }

    // 2. Remove previously saved media of the same context before saving new metadata
    const category = this.inferCategoryFromStorageKey(params.storageKey);
    if (category) {
      await this.deleteMediaByContext({
        category,
        userId: params.userId,
        tripId: params.tripId,
        excludeStorageKey: params.storageKey,
      });
    }

    // 3. Persist metadata in database
    const publicUrl = env.R2_PUBLIC_BASE_URL
      ? `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${params.storageKey}`
      : `${env.API_BASE_URL}/api/v1/files/${encodeURIComponent(params.storageKey)}`;
    const metadata = await prisma.fileMetadata.create({
      data: {
        userId: params.userId,
        tripId: params.tripId,
        fileName: params.storageKey.split('/').pop() || params.originalName,
        originalName: params.originalName,
        mimeType: verification.contentType || params.mimeType,
        sizeBytes: actualSize,
        storageKey: params.storageKey,
        publicUrl,
      },
    });

    return metadata;
  }

  /**
   * Generates a short-lived download URL with resource-level authorization checks.
   */
  static async getAuthorizedDownloadUrl(
    storageKey: string,
    requestingUserId: string,
    expiresInSeconds = 900
  ): Promise<{ downloadUrl: string; mimeType: string; fileName: string }> {
    const file = await prisma.fileMetadata.findFirst({
      where: { storageKey },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Check authorization:
    // Avatars, trip covers, and payment QRs are public media assets within the app
    const isPublicAsset =
      file.storageKey.includes('/avatars/') ||
      file.storageKey.includes('/covers/') ||
      file.storageKey.includes('/payment-qr/');

    if (!isPublicAsset) {
      // If associated with a trip, user must be an active member of the trip
      if (file.tripId) {
        const isMember = await prisma.tripMember.findFirst({
          where: {
            tripId: file.tripId,
            userId: requestingUserId,
            status: 'ACTIVE',
          },
        });

        if (!isMember) {
          throw new Error('Forbidden: You do not have permission to view this file');
        }
      } else if (file.userId && file.userId !== requestingUserId) {
        // If it's a private user file, verify if requesting user shares any trip with this user
        const sharedTrip = await prisma.tripMember.findFirst({
          where: {
            userId: requestingUserId,
            status: 'ACTIVE',
            trip: {
              members: {
                some: {
                  userId: file.userId,
                  status: 'ACTIVE',
                },
              },
            },
          },
        });

        if (!sharedTrip) {
          throw new Error('Forbidden: You do not share a trip with the owner of this file');
        }
      }
    }

    const driver = getStorageDriver();
    const downloadUrl = await driver.createPresignedDownloadUrl(storageKey, expiresInSeconds);

    return {
      downloadUrl,
      mimeType: file.mimeType,
      fileName: file.originalName,
    };
  }

  /**
   * Direct upload for internal server routes / backwards compatibility.
   */
  static async uploadDirect(params: {
    userId: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    category?: FileCategory;
    tripId?: string;
    expenseId?: string;
    paymentId?: string;
  }) {
    const env = getEnv();

    const allowedMimes = env.FILE_ALLOWED_MIME_TYPES.split(',').map((m) => m.trim().toLowerCase());
    if (!allowedMimes.includes(params.mimeType.toLowerCase())) {
      throw new Error(`File type "${params.mimeType}" is not allowed.`);
    }

    if (params.buffer.length > env.FILE_MAX_SIZE_BYTES) {
      throw new Error(`File size exceeds 10MB limit`);
    }

    const category = params.category || 'EXPENSE_RECEIPT';

    const { storageKey } = generateStorageKey({
      category,
      userId: params.userId,
      tripId: params.tripId,
      expenseId: params.expenseId,
      paymentId: params.paymentId,
      originalName: params.originalName,
      mimeType: params.mimeType,
    });

    // 1. Remove previously saved media of the same context before saving new media
    await this.deleteMediaByContext({
      category,
      userId: params.userId,
      tripId: params.tripId,
      expenseId: params.expenseId,
      paymentId: params.paymentId,
      excludeStorageKey: storageKey,
    });

    // 2. Persist to storage driver
    const driver = getStorageDriver();
    const { publicUrl } = await driver.saveDirect(storageKey, params.buffer, params.mimeType);

    // 3. Record new FileMetadata
    const metadata = await prisma.fileMetadata.create({
      data: {
        userId: params.userId,
        tripId: params.tripId,
        fileName: storageKey.split('/').pop() || params.originalName,
        originalName: params.originalName,
        mimeType: params.mimeType,
        sizeBytes: params.buffer.length,
        storageKey,
        publicUrl,
      },
    });

    return metadata;
  }

  /**
   * Infer the logical FileCategory from a storage key path.
   */
  static inferCategoryFromStorageKey(storageKey: string): FileCategory | null {
    if (storageKey.includes('/avatars/')) return 'AVATAR';
    if (storageKey.includes('/payment-qr/') || storageKey.startsWith('temp/registration-qr/')) return 'PAYMENT_QR';
    if (storageKey.includes('/covers/')) return 'TRIP_COVER';
    if (storageKey.includes('/expenses/')) return 'EXPENSE_RECEIPT';
    if (storageKey.includes('/payments/')) return 'PAYMENT_RECEIPT';
    return null;
  }

  /**
   * Delete media file and its metadata record given its public URL or storage key.
   */
  static async deleteMediaByUrl(urlOrKey?: string | null): Promise<boolean> {
    if (!urlOrKey) return false;
    const storageKey = extractStorageKey(urlOrKey);

    const driver = getStorageDriver();
    let deletedCount = 0;

    const files = await prisma.fileMetadata.findMany({
      where: {
        OR: [
          ...(storageKey ? [{ storageKey }] : []),
          { publicUrl: urlOrKey },
          ...(storageKey ? [{ publicUrl: { contains: encodeURIComponent(storageKey) } }] : []),
        ],
      },
    });

    for (const file of files) {
      try {
        await driver.deleteObject(file.storageKey);
      } catch (err) {
        console.warn(`[Storage] Failed to delete object ${file.storageKey}: ${(err as Error).message}`);
      }
      await prisma.fileMetadata.delete({ where: { id: file.id } }).catch(() => {});
      deletedCount++;
    }

    if (files.length === 0 && storageKey) {
      try {
        await driver.deleteObject(storageKey);
        deletedCount++;
      } catch {
        // Silently catch if already removed
      }
    }

    return deletedCount > 0;
  }

  /**
   * Remove previously saved media for the same context before/after saving new media.
   * Ensures that updating an avatar, payment QR, trip cover, or receipt does not leave
   * stale orphaned media in storage.
   */
  static async deleteMediaByContext(params: DeleteMediaContextParams): Promise<number> {
    const driver = getStorageDriver();
    const keysToDelete = new Set<string>();
    const fileIdsToDelete = new Set<string>();
    const excludeKey = params.excludeStorageKey;

    switch (params.category) {
      case 'AVATAR': {
        if (params.userId) {
          const existing = await prisma.fileMetadata.findMany({
            where: {
              userId: params.userId,
              storageKey: { contains: '/avatars/' },
              ...(excludeKey ? { storageKey: { not: excludeKey } } : {}),
            },
          });
          for (const f of existing) {
            keysToDelete.add(f.storageKey);
            fileIdsToDelete.add(f.id);
          }

          const user = await prisma.user.findUnique({
            where: { id: params.userId },
            select: { avatarUrl: true },
          });
          if (user?.avatarUrl) {
            const key = extractStorageKey(user.avatarUrl);
            if (key && key !== excludeKey) {
              keysToDelete.add(key);
            }
          }
        }
        break;
      }

      case 'PAYMENT_QR': {
        if (params.userId) {
          const existing = await prisma.fileMetadata.findMany({
            where: {
              userId: params.userId,
              OR: [
                { storageKey: { contains: '/payment-qr/' } },
                { storageKey: { startsWith: 'temp/registration-qr/' } },
              ],
              ...(excludeKey ? { storageKey: { not: excludeKey } } : {}),
            },
          });
          for (const f of existing) {
            keysToDelete.add(f.storageKey);
            fileIdsToDelete.add(f.id);
          }

          const user = await prisma.user.findUnique({
            where: { id: params.userId },
            select: { paymentQrUrl: true },
          });
          if (user?.paymentQrUrl) {
            const key = extractStorageKey(user.paymentQrUrl);
            if (key && key !== excludeKey) {
              keysToDelete.add(key);
            }
          }
        }
        break;
      }

      case 'TRIP_COVER': {
        if (params.tripId) {
          const existing = await prisma.fileMetadata.findMany({
            where: {
              tripId: params.tripId,
              storageKey: { contains: '/covers/' },
              ...(excludeKey ? { storageKey: { not: excludeKey } } : {}),
            },
          });
          for (const f of existing) {
            keysToDelete.add(f.storageKey);
            fileIdsToDelete.add(f.id);
          }

          const trip = await prisma.trip.findUnique({
            where: { id: params.tripId },
            select: { coverImageUrl: true },
          });
          if (trip?.coverImageUrl) {
            const key = extractStorageKey(trip.coverImageUrl);
            if (key && key !== excludeKey) {
              keysToDelete.add(key);
            }
          }
        } else if (params.userId) {
          const existing = await prisma.fileMetadata.findMany({
            where: {
              userId: params.userId,
              tripId: null,
              storageKey: { contains: '/covers/' },
              ...(excludeKey ? { storageKey: { not: excludeKey } } : {}),
            },
          });
          for (const f of existing) {
            keysToDelete.add(f.storageKey);
            fileIdsToDelete.add(f.id);
          }
        }
        break;
      }

      case 'EXPENSE_RECEIPT': {
        if (params.expenseId && params.expenseId !== 'draft') {
          const existing = await prisma.fileMetadata.findMany({
            where: {
              storageKey: { contains: `/expenses/${params.expenseId}/` },
              ...(excludeKey ? { storageKey: { not: excludeKey } } : {}),
            },
          });
          for (const f of existing) {
            keysToDelete.add(f.storageKey);
            fileIdsToDelete.add(f.id);
          }

          const expense = await prisma.expense.findUnique({
            where: { id: params.expenseId },
            select: { receiptUrl: true },
          });
          if (expense?.receiptUrl) {
            const key = extractStorageKey(expense.receiptUrl);
            if (key && key !== excludeKey) {
              keysToDelete.add(key);
            }
          }
        } else if (params.tripId) {
          const existing = await prisma.fileMetadata.findMany({
            where: {
              tripId: params.tripId,
              storageKey: { contains: '/expenses/draft/' },
              ...(excludeKey ? { storageKey: { not: excludeKey } } : {}),
            },
          });
          for (const f of existing) {
            keysToDelete.add(f.storageKey);
            fileIdsToDelete.add(f.id);
          }
        }
        break;
      }

      case 'PAYMENT_RECEIPT': {
        if (params.paymentId && params.paymentId !== 'draft') {
          const existing = await prisma.fileMetadata.findMany({
            where: {
              storageKey: { contains: `/payments/${params.paymentId}/` },
              ...(excludeKey ? { storageKey: { not: excludeKey } } : {}),
            },
          });
          for (const f of existing) {
            keysToDelete.add(f.storageKey);
            fileIdsToDelete.add(f.id);
          }

          const payment = await prisma.payment.findUnique({
            where: { id: params.paymentId },
            select: { receiptUrl: true },
          });
          if (payment?.receiptUrl) {
            const key = extractStorageKey(payment.receiptUrl);
            if (key && key !== excludeKey) {
              keysToDelete.add(key);
            }
          }
        }
        break;
      }
    }

    for (const key of keysToDelete) {
      try {
        await driver.deleteObject(key);
      } catch (err) {
        console.warn(`[Storage] Failed to delete object ${key}: ${(err as Error).message}`);
      }
    }

    if (fileIdsToDelete.size > 0) {
      await prisma.fileMetadata.deleteMany({
        where: { id: { in: Array.from(fileIdsToDelete) } },
      });
    }

    return keysToDelete.size;
  }

  /**
   * Retrieve file buffer for embedding in PDF reports.
   */
  static async getFileBuffer(storageKey: string): Promise<Buffer> {
    const driver = getStorageDriver();
    return driver.getObjectBuffer(storageKey);
  }

  /**
   * Cleanup orphaned storage object if not referenced in database.
   */
  static async cleanupOrphan(storageKey: string): Promise<boolean> {
    const file = await prisma.fileMetadata.findFirst({
      where: { storageKey },
    });

    if (!file) {
      const driver = getStorageDriver();
      await driver.deleteObject(storageKey);
      return true;
    }

    return false;
  }
}

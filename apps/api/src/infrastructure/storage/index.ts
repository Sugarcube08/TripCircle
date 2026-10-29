import { getEnv } from '../../lib/env';
import { prisma } from '../../lib/prisma';
import { IStorageDriver, PresignedUploadRequest, PresignedUploadResponse, FileCategory } from './types';
import { R2StorageService } from './r2.service';
import { LocalStorageService } from './local.service';
import { generateStorageKey } from './key-generator';

export * from './types';
export * from './key-generator';

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

    // 2. Persist metadata in database
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
  }) {
    const env = getEnv();

    const allowedMimes = env.FILE_ALLOWED_MIME_TYPES.split(',').map((m) => m.trim().toLowerCase());
    if (!allowedMimes.includes(params.mimeType.toLowerCase())) {
      throw new Error(`File type "${params.mimeType}" is not allowed.`);
    }

    if (params.buffer.length > env.FILE_MAX_SIZE_BYTES) {
      throw new Error(`File size exceeds 10MB limit`);
    }

    const { storageKey } = generateStorageKey({
      category: params.category || 'EXPENSE_RECEIPT',
      userId: params.userId,
      tripId: params.tripId,
      originalName: params.originalName,
      mimeType: params.mimeType,
    });

    const driver = getStorageDriver();
    const { publicUrl } = await driver.saveDirect(storageKey, params.buffer, params.mimeType);

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

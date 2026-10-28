import fs from 'fs';
import path from 'path';
import { getEnv } from '../../lib/env';
import {
  IStorageDriver,
  PresignedUploadRequest,
  PresignedUploadResponse,
  StorageMetadata,
} from './types';
import { generateStorageKey } from './key-generator';

export class LocalStorageService implements IStorageDriver {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getAbsolutePath(storageKey: string): string {
    // Prevent path traversal
    const safeKey = storageKey.replace(/\.\./g, '');
    return path.join(this.baseDir, safeKey);
  }

  async createPresignedUploadUrl(
    request: PresignedUploadRequest
  ): Promise<PresignedUploadResponse> {
    const { storageKey, fileId } = generateStorageKey({
      category: request.category,
      userId: request.userId,
      tripId: request.tripId,
      expenseId: request.expenseId,
      paymentId: request.paymentId,
      originalName: request.fileName,
      mimeType: request.mimeType,
    });

    const env = getEnv();
    const uploadUrl = `${env.API_BASE_URL}/api/v1/files/upload?storageKey=${encodeURIComponent(storageKey)}`;

    return {
      fileId,
      uploadUrl,
      storageKey,
      expiresInSeconds: 300,
      headers: {
        'Content-Type': request.mimeType,
      },
    };
  }

  async createPresignedDownloadUrl(
    storageKey: string,
    _expiresInSeconds = 900
  ): Promise<string> {
    const env = getEnv();
    return `${env.API_BASE_URL}/api/v1/files/${encodeURIComponent(storageKey)}`;
  }

  async verifyObject(storageKey: string): Promise<StorageMetadata> {
    const filePath = this.getAbsolutePath(storageKey);
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        exists: true,
        sizeBytes: stats.size,
        lastModified: stats.mtime,
      };
    } catch {
      return { exists: false };
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    const filePath = this.getAbsolutePath(storageKey);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.warn(`[LocalStorage] Failed to delete ${filePath}: ${(err as Error).message}`);
    }
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const filePath = this.getAbsolutePath(storageKey);
    return fs.promises.readFile(filePath);
  }

  async saveDirect(
    storageKey: string,
    buffer: Buffer,
    _mimeType: string
  ): Promise<{ storageKey: string; publicUrl: string }> {
    const filePath = this.getAbsolutePath(storageKey);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(filePath, buffer);
    const env = getEnv();
    const publicUrl = `${env.API_BASE_URL}/api/v1/files/${encodeURIComponent(storageKey)}`;

    return { storageKey, publicUrl };
  }
}

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { getEnv } from '../../lib/env';
import {
  IStorageDriver,
  PresignedUploadRequest,
  PresignedUploadResponse,
  StorageMetadata,
} from './types';
import { generateStorageKey } from './key-generator';

export class R2StorageService implements IStorageDriver {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    const env = getEnv();
    const endpoint =
      env.R2_ENDPOINT ||
      (env.R2_ACCOUNT_ID
        ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined);

    if (!endpoint) {
      throw new Error('R2_ENDPOINT or R2_ACCOUNT_ID is required to initialize R2 client');
    }

    this.bucket = env.R2_BUCKET_NAME || 'tripcircle-assets';
    this.s3Client = new S3Client({
      region: env.R2_REGION || 'auto',
      endpoint,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
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

    const expiresInSeconds = 300; // 5 minutes validity

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: request.mimeType,
      ...(request.sizeBytes ? { ContentLength: request.sizeBytes } : {}),
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      fileId,
      uploadUrl,
      storageKey,
      expiresInSeconds,
      headers: {
        'Content-Type': request.mimeType,
      },
    };
  }

  async createPresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds = 900
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async verifyObject(storageKey: string): Promise<StorageMetadata> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      const response = await this.s3Client.send(command);
      return {
        exists: true,
        sizeBytes: response.ContentLength,
        contentType: response.ContentType,
        etag: response.ETag,
        lastModified: response.LastModified,
      };
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return { exists: false };
      }
      throw err;
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    await this.s3Client.send(command);
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`Empty body returned for storage key: ${storageKey}`);
    }

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async saveDirect(
    storageKey: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ storageKey: string; publicUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.length,
    });

    await this.s3Client.send(command);

    const env = getEnv();
    const publicUrl = env.R2_PUBLIC_BASE_URL
      ? `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${storageKey}`
      : `/api/v1/files/${encodeURIComponent(storageKey)}`;

    return { storageKey, publicUrl };
  }
}

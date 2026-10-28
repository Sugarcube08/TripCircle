export type FileCategory =
  | 'AVATAR'
  | 'PAYMENT_QR'
  | 'EXPENSE_RECEIPT'
  | 'PAYMENT_RECEIPT'
  | 'TRIP_COVER';

export interface PresignedUploadRequest {
  category: FileCategory;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  userId: string;
  tripId?: string;
  expenseId?: string;
  paymentId?: string;
}

export interface PresignedUploadResponse {
  fileId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  headers?: Record<string, string>;
}

export interface StorageMetadata {
  exists: boolean;
  sizeBytes?: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
}

export interface IStorageDriver {
  createPresignedUploadUrl(request: PresignedUploadRequest): Promise<PresignedUploadResponse>;
  createPresignedDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  verifyObject(storageKey: string): Promise<StorageMetadata>;
  deleteObject(storageKey: string): Promise<void>;
  getObjectBuffer(storageKey: string): Promise<Buffer>;
  saveDirect(
    storageKey: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ storageKey: string; publicUrl: string }>;
}

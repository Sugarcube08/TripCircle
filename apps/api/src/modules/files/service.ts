import { StorageService, FileCategory } from '../../infrastructure/storage';

export class FileService {
  /**
   * Request presigned upload URL for direct upload to R2
   */
  static async requestUploadUrl(params: {
    userId: string;
    category: FileCategory;
    fileName: string;
    mimeType: string;
    sizeBytes?: number;
    tripId?: string;
    expenseId?: string;
    paymentId?: string;
  }) {
    return StorageService.requestUpload(params);
  }

  /**
   * Confirm that direct upload finished and store metadata in MySQL
   */
  static async confirmUpload(params: {
    userId: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes?: number;
    tripId?: string;
  }) {
    return StorageService.confirmUpload(params);
  }

  /**
   * Retrieve authorized download URL for private files
   */
  static async getDownloadUrl(storageKey: string, requestingUserId: string) {
    return StorageService.getAuthorizedDownloadUrl(storageKey, requestingUserId);
  }

  /**
   * Upload binary directly (legacy / server-side fallback)
   */
  static async uploadFile(
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    tripId?: string,
    category?: FileCategory
  ) {
    return StorageService.uploadDirect({
      userId,
      buffer: fileBuffer,
      originalName,
      mimeType,
      category,
      tripId,
    });
  }
}

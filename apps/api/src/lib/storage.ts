import { StorageService, getStorageDriver } from '../infrastructure/storage';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  userId = 'system',
  tripId?: string
): Promise<{ fileName: string; storageKey: string; publicUrl: string }> {
  const metadata = await StorageService.uploadDirect({
    userId,
    buffer,
    originalName,
    mimeType,
    tripId,
  });

  return {
    fileName: metadata.fileName,
    storageKey: metadata.storageKey,
    publicUrl: metadata.publicUrl,
  };
}

export { StorageService, getStorageDriver };

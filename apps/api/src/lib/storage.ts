import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
  mimeType: string
): Promise<{ fileName: string; storageKey: string; publicUrl: string }> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Allowed types: JPEG, PNG, WEBP, PDF`);
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds 10MB limit`);
  }

  const ext = path.extname(originalName) || '.jpg';
  const randomName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(UPLOAD_DIR, randomName);

  await fs.promises.writeFile(filePath, buffer);

  const publicUrl = `/api/v1/files/${randomName}`;

  return {
    fileName: randomName,
    storageKey: filePath,
    publicUrl,
  };
}

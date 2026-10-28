import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getStorageDriver } from '@/infrastructure/storage';
import { createRegistrationQrToken } from '@/lib/registration-token';
import { successResponse, handleApiError } from '@/lib/api-response';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

function validateImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 8) return false;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    mimeType === 'image/png' &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  // JPEG / JPG: FF D8 FF
  if (
    (mimeType === 'image/jpeg' || mimeType === 'image/jpg') &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return true;
  }

  // WebP: RIFF ... WEBP
  if (
    mimeType === 'image/webp' &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      throw new Error('No QR image file provided in form-data');
    }

    const mimeType = (file.type || 'image/png').toLowerCase();
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    if (!allowedTypes.includes(mimeType)) {
      throw new Error(`Invalid image type "${mimeType}". Allowed formats: PNG, JPEG, WEBP.`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 5MB limit for QR image
    const MAX_QR_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_QR_SIZE) {
      throw new Error('QR image exceeds 5MB maximum size limit');
    }

    // Validate magic bytes
    if (!validateImageMagicBytes(buffer, mimeType)) {
      throw new Error('File content does not match declared image format');
    }

    // Generate opaque server-controlled temporary storage key
    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const uuid = crypto.randomUUID();
    const storageKey = `temp/registration-qr/${uuid}.${extension}`;

    // Store via driver
    const driver = getStorageDriver();
    const directResult = await driver.saveDirect(storageKey, buffer, mimeType);

    // Sign temporary ticket
    const qrToken = createRegistrationQrToken({
      storageKey,
      originalName: file.name || `payment-qr.${extension}`,
      mimeType,
      sizeBytes: buffer.length,
    });

    const env = getEnv();
    const finalPublicUrl =
      directResult.publicUrl ||
      `${env.API_BASE_URL}/api/v1/files/${encodeURIComponent(storageKey)}`;

    return successResponse(
      {
        token: qrToken,
        storageKey,
        publicUrl: finalPublicUrl,
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}

import crypto from 'crypto';
import { getEnv } from './env';

export interface RegistrationQrPayload {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: number;
}

export function createRegistrationQrToken(data: {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): string {
  const env = getEnv();
  const payload: RegistrationQrPayload = {
    ...data,
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes validity
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyRegistrationQrToken(token: string): RegistrationQrPayload {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing registration QR token');
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Malformed registration QR token');
  }

  const [payloadB64, providedSig] = parts;
  const env = getEnv();

  const expectedSig = crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(payloadB64)
    .digest('base64url');

  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
  ) {
    throw new Error('Invalid registration QR token signature');
  }

  const payload: RegistrationQrPayload = JSON.parse(
    Buffer.from(payloadB64, 'base64url').toString('utf-8')
  );

  if (Date.now() > payload.expiresAt) {
    throw new Error('Registration QR token has expired. Please re-upload your payment QR code.');
  }

  return payload;
}

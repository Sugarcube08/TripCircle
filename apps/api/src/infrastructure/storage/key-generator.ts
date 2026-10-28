import crypto from 'crypto';
import path from 'path';
import { FileCategory } from './types';

function sanitizeId(id?: string): string {
  if (!id) return '';
  // Ensure no path traversal characters
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!clean) throw new Error(`Invalid identifier: ${id}`);
  return clean;
}

export function getSafeExtension(originalName: string, mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'application/pdf': '.pdf',
  };

  if (mimeMap[mimeType]) {
    return mimeMap[mimeType];
  }

  const ext = path.extname(originalName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.heic'].includes(ext)) {
    return ext === '.jpeg' ? '.jpg' : ext;
  }

  return '.bin';
}

export function generateStorageKey(params: {
  category: FileCategory;
  userId: string;
  tripId?: string;
  expenseId?: string;
  paymentId?: string;
  originalName: string;
  mimeType: string;
}): { storageKey: string; fileId: string } {
  const fileId = crypto.randomUUID();
  const ext = getSafeExtension(params.originalName, params.mimeType);
  const user = sanitizeId(params.userId);
  const trip = sanitizeId(params.tripId);
  const expense = sanitizeId(params.expenseId || 'draft');
  const payment = sanitizeId(params.paymentId || 'draft');

  let key: string;

  switch (params.category) {
    case 'AVATAR':
      key = `users/${user}/avatars/${fileId}${ext}`;
      break;
    case 'PAYMENT_QR':
      key = `users/${user}/payment-qr/${fileId}${ext}`;
      break;
    case 'EXPENSE_RECEIPT':
      if (!trip) throw new Error('tripId is required for expense receipts');
      key = `trips/${trip}/expenses/${expense}/${fileId}${ext}`;
      break;
    case 'PAYMENT_RECEIPT':
      if (!trip) throw new Error('tripId is required for payment receipts');
      key = `trips/${trip}/payments/${payment}/${fileId}${ext}`;
      break;
    case 'TRIP_COVER':
      if (!trip) throw new Error('tripId is required for trip covers');
      key = `trips/${trip}/covers/${fileId}${ext}`;
      break;
    default:
      key = `uploads/${user}/${fileId}${ext}`;
  }

  return { storageKey: key, fileId };
}

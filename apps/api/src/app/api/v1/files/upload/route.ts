import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { FileService } from '@/modules/files/service';
import { successResponse, handleApiError } from '@/lib/api-response';
import { FileCategory, getStorageDriver } from '@/infrastructure/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const contentType = req.headers.get('content-type') || '';

    // Handle JSON request for presigned upload URL
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const result = await FileService.requestUploadUrl({
        userId: authUser.id,
        category: (body.category as FileCategory) || 'EXPENSE_RECEIPT',
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        tripId: body.tripId,
        expenseId: body.expenseId,
        paymentId: body.paymentId,
      });

      return successResponse(result, 200);
    }

    // Handle multipart/form-data direct upload
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tripId = formData.get('tripId') as string | null;
    const expenseId = formData.get('expenseId') as string | null;
    const paymentId = formData.get('paymentId') as string | null;
    const category = (formData.get('category') as FileCategory) || 'EXPENSE_RECEIPT';

    if (!file) {
      throw new Error('No file provided in form-data');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await FileService.uploadFile(
      authUser.id,
      buffer,
      file.name,
      file.type,
      tripId || undefined,
      category,
      expenseId || undefined,
      paymentId || undefined
    );

    return successResponse(metadata, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const storageKey = url.searchParams.get('storageKey');
    if (!storageKey) {
      return NextResponse.json({ error: 'Missing storageKey in query parameter' }, { status: 400 });
    }
    const buffer = Buffer.from(await req.arrayBuffer());
    const contentType = req.headers.get('content-type') || 'application/octet-stream';
    const driver = getStorageDriver();
    await driver.saveDirect(storageKey, buffer, contentType);
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

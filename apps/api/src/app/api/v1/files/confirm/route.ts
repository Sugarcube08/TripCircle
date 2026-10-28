import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { FileService } from '@/modules/files/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();

    if (!body.storageKey || !body.originalName || !body.mimeType) {
      throw new Error('storageKey, originalName, and mimeType are required');
    }

    const metadata = await FileService.confirmUpload({
      userId: authUser.id,
      storageKey: body.storageKey,
      originalName: body.originalName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      tripId: body.tripId,
    });

    return successResponse(metadata, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

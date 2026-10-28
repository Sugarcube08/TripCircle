import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { FileService } from '@/modules/files/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tripId = formData.get('tripId') as string | null;

    if (!file) {
      throw new Error('No file provided in form-data');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await FileService.uploadFile(
      authUser.id,
      buffer,
      file.name,
      file.type,
      tripId || undefined
    );

    return successResponse(metadata, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

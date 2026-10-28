import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { NotificationService } from '@/modules/notifications/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    if (!body.token) throw new Error('Push token is required');

    const result = await NotificationService.registerPushToken(
      authUser.id,
      body.token,
      body.platform || 'expo'
    );
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { NotificationService } from '@/modules/notifications/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const notifications = await NotificationService.listNotifications(authUser.id);
    return successResponse(notifications);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const result = await NotificationService.markAsRead(authUser.id, body.notificationId);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

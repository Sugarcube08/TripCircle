import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { SyncPullSchema } from '@tripcircle/contracts';
import { SyncService } from '@/modules/sync/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const validated = SyncPullSchema.parse(body);
    const result = await SyncService.pullChanges(
      authUser.id,
      validated.lastSyncTimestamp,
      validated.tripIds
    );
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

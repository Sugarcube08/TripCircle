import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { UserService } from '@/modules/users/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const profile = await UserService.getProfile(authUser.id);
    return successResponse(profile);
  } catch (err) {
    return handleApiError(err);
  }
}

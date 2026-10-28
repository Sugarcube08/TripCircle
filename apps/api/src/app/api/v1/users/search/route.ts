import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { UserService } from '@/modules/users/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const users = await UserService.searchUsers(query, authUser.id);
    return successResponse(users);
  } catch (err) {
    return handleApiError(err);
  }
}

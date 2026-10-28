import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { ChangePasswordSchema } from '@tripcircle/contracts';
import { UserService } from '@/modules/users/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = ChangePasswordSchema.parse(body);
    const result = await UserService.changePassword(authUser.id, validated);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

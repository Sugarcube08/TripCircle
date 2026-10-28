import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { UpdateProfileSchema } from '@tripcircle/contracts';
import { UserService } from '@/modules/users/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = UpdateProfileSchema.parse(body);
    const updated = await UserService.updateProfile(authUser.id, validated);
    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

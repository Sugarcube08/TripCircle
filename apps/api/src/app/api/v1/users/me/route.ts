import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { UserService } from '@/modules/users/service';
import { UpdateProfileSchema } from '@tripcircle/contracts';
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

export async function PATCH(req: NextRequest) {
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

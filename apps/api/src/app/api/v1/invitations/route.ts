import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { MembershipService } from '@/modules/memberships/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const invitations = await MembershipService.getPendingInvitations(authUser.id);
    return successResponse(invitations);
  } catch (err) {
    return handleApiError(err);
  }
}

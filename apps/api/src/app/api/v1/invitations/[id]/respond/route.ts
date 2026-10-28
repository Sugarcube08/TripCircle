import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { RespondInviteSchema } from '@tripcircle/contracts';
import { MembershipService } from '@/modules/memberships/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = RespondInviteSchema.parse(body);
    const result = await MembershipService.respondInvite(params.id, authUser.id, validated);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

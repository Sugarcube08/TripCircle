import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { ReplaceDummyMemberSchema } from '@tripcircle/contracts';
import { MembershipService } from '@/modules/memberships/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = ReplaceDummyMemberSchema.parse(body);
    const member = await MembershipService.replaceDummyMember(
      params.id,
      authUser.id,
      params.memberId,
      validated
    );
    return successResponse(member);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { AddDummyMemberSchema } from '@tripcircle/contracts';
import { MembershipService } from '@/modules/memberships/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = AddDummyMemberSchema.parse(body);
    const member = await MembershipService.addDummyMember(params.id, authUser.id, validated);
    return successResponse(member, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

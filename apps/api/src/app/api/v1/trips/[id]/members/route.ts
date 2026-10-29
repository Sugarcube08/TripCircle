import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { InviteMemberSchema } from '@tripcircle/contracts';
import { MembershipService } from '@/modules/memberships/service';
import { prisma } from '@/lib/prisma';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    // Verify membership
    const isMember = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId: params.id, userId: authUser.id } },
    });
    if (!isMember) throw new Error('Forbidden: Not a member of this trip');

    const members = await prisma.tripMember.findMany({
      where: { tripId: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, avatarUrl: true, paymentQrUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const mapped = members.map((m) => ({
      ...m,
      user: m.user || {
        id: m.id,
        name: m.displayName || 'Offline Member',
        email: m.email || '',
        phone: m.phone || null,
        avatarUrl: null,
        paymentQrUrl: null,
      },
    }));

    return successResponse(mapped);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = InviteMemberSchema.parse(body);
    const member = await MembershipService.inviteMember(params.id, authUser.id, validated);
    return successResponse(member, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

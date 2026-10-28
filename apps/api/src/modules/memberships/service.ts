import { prisma } from '../../lib/prisma';
import { InviteMemberInput, RespondInviteInput } from '@tripcircle/contracts';

export class MembershipService {
  static async inviteMember(tripId: string, currentUserId: string, input: InviteMemberInput) {
    // Verify current user is member with permissions
    const inviter = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: currentUserId } },
    });

    if (!inviter || inviter.status !== 'ACTIVE') {
      throw new Error('Forbidden: Only active members can invite others');
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.status === 'CLOSED') {
      throw new Error('Cannot invite members to a closed trip');
    }

    // Find target user by email or ID
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.userIdOrEmail.toLowerCase().trim() },
          { id: input.userIdOrEmail.trim() },
        ],
      },
    });

    if (!targetUser) {
      throw new Error(`User "${input.userIdOrEmail}" is not registered on TripCircle.`);
    }

    // Check existing membership
    const existingMember = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: targetUser.id } },
    });

    if (existingMember) {
      if (existingMember.status === 'ACTIVE') {
        throw new Error('User is already an active member of this trip.');
      }
      if (existingMember.status === 'INVITED') {
        throw new Error('User already has a pending invitation to this trip.');
      }
      // If DECLINED or LEFT, re-invite them
      const updated = await prisma.tripMember.update({
        where: { id: existingMember.id },
        data: {
          status: 'INVITED',
          invitedAt: new Date(),
          respondedAt: null,
          leftAt: null,
        },
        include: { user: true },
      });

      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          tripId,
          type: 'TRIP_INVITATION',
          title: `Invitation to ${trip.name}`,
          body: `You have been re-invited to join "${trip.name}".`,
          data: { tripId },
        },
      });

      return updated;
    }

    const member = await prisma.tripMember.create({
      data: {
        tripId,
        userId: targetUser.id,
        role: 'MEMBER',
        status: 'INVITED',
      },
      include: { user: true },
    });

    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        tripId,
        type: 'TRIP_INVITATION',
        title: `Invitation to ${trip.name}`,
        body: `You have been invited to join "${trip.name}".`,
        data: { tripId },
      },
    });

    return member;
  }

  static async respondInvite(tripMemberId: string, userId: string, input: RespondInviteInput) {
    const member = await prisma.tripMember.findUnique({
      where: { id: tripMemberId },
      include: { trip: true },
    });

    if (!member) throw new Error('Invitation not found');
    if (member.userId !== userId) throw new Error('Forbidden: This invitation is not for you');
    if (member.status !== 'INVITED') throw new Error('Invitation is no longer pending');

    const newStatus = input.action === 'ACCEPT' ? 'ACTIVE' : 'DECLINED';

    const updated = await prisma.tripMember.update({
      where: { id: tripMemberId },
      data: {
        status: newStatus,
        respondedAt: new Date(),
      },
      include: { trip: true, user: true },
    });

    // Notify trip creator
    await prisma.notification.create({
      data: {
        userId: member.trip.creatorId,
        tripId: member.tripId,
        type: 'INVITATION_RESPONSE',
        title: `Invitation ${input.action.toLowerCase()}ed`,
        body: `${updated.user.name} has ${input.action.toLowerCase()}ed the invitation to "${member.trip.name}".`,
        data: { tripId: member.tripId, memberId: member.id },
      },
    });

    return updated;
  }

  static async getPendingInvitations(userId: string) {
    const invitations = await prisma.tripMember.findMany({
      where: {
        userId,
        status: 'INVITED',
      },
      include: {
        trip: {
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            members: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    return invitations.map((inv) => ({
      invitationId: inv.id,
      tripId: inv.trip.id,
      tripName: inv.trip.name,
      destination: inv.trip.destination,
      startDate: inv.trip.startDate.toISOString(),
      creatorName: inv.trip.creator.name,
      creatorAvatar: inv.trip.creator.avatarUrl,
      memberCount: inv.trip.members.filter((m) => m.status === 'ACTIVE').length,
      invitedAt: inv.invitedAt.toISOString(),
    }));
  }
}

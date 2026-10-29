import { prisma } from '../../lib/prisma';
import {
  InviteMemberInput,
  RespondInviteInput,
  AddDummyMemberInput,
  ReplaceDummyMemberInput,
} from '@tripcircle/contracts';

export class MembershipService {
  static async addDummyMember(tripId: string, currentUserId: string, input: AddDummyMemberInput) {
    const inviter = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: currentUserId } },
    });

    if (!inviter || inviter.status !== 'ACTIVE') {
      throw new Error('Forbidden: Only active members can add offline members');
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.status === 'CLOSED') {
      throw new Error('Cannot add members to a closed trip');
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Member name is required');
    }

    const member = await prisma.tripMember.create({
      data: {
        tripId,
        userId: null,
        isDummy: true,
        displayName: trimmedName,
        email: input.email ? input.email.toLowerCase().trim() : null,
        phone: input.phone ? input.phone.trim() : null,
        role: 'MEMBER',
        status: 'ACTIVE',
        respondedAt: new Date(),
      },
      include: { user: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUserId,
        tripId,
        action: 'ADD_DUMMY_MEMBER',
        entityType: 'TRIP_MEMBER',
        entityId: member.id,
        details: { displayName: trimmedName, email: input.email, phone: input.phone },
      },
    });

    return member;
  }

  static async replaceDummyMember(
    tripId: string,
    currentUserId: string,
    dummyMemberId: string,
    input: ReplaceDummyMemberInput
  ) {
    const inviter = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: currentUserId } },
    });

    if (!inviter || inviter.status !== 'ACTIVE' || inviter.role !== 'CREATOR') {
      throw new Error('Forbidden: Only the trip creator can replace offline members with registered users');
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.status === 'CLOSED') {
      throw new Error('Cannot modify members of a closed trip');
    }

    const dummyMember = await prisma.tripMember.findUnique({
      where: { id: dummyMemberId },
    });

    if (!dummyMember || dummyMember.tripId !== tripId) {
      throw new Error('Trip member not found');
    }

    if (!dummyMember.isDummy) {
      throw new Error('This member is already linked to a registered account');
    }

    const registeredUser = await prisma.user.findUnique({
      where: { id: input.registeredUserId },
    });

    if (!registeredUser) {
      throw new Error('Target registered user does not exist');
    }

    const existingMember = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: input.registeredUserId } },
    });

    if (existingMember) {
      throw new Error('User is already a member of this trip');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.tripMember.update({
        where: { id: dummyMemberId },
        data: {
          userId: input.registeredUserId,
          isDummy: false,
          displayName: registeredUser.name,
          email: registeredUser.email,
          phone: registeredUser.phone || dummyMember.phone,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, avatarUrl: true, paymentQrUrl: true },
          },
        },
      });

      await tx.notification.create({
        data: {
          userId: input.registeredUserId,
          tripId,
          type: 'DUMMY_MEMBER_REPLACED',
          title: `Added to Trip "${trip.name}"`,
          body: `You have taken over the ledger and balance history for "${dummyMember.displayName || 'Offline Member'}" in trip "${trip.name}".`,
          data: { tripId, memberId: dummyMemberId },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          tripId,
          action: 'REPLACE_DUMMY_MEMBER',
          entityType: 'TRIP_MEMBER',
          entityId: dummyMemberId,
          details: {
            previousDisplayName: dummyMember.displayName,
            newUserId: input.registeredUserId,
            newUserName: registeredUser.name,
          },
        },
      });

      return updated;
    });
  }
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

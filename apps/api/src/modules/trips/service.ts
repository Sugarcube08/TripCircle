import { prisma } from '../../lib/prisma';
import { CreateTripInput, UpdateTripInput } from '@tripcircle/contracts';
import { calculateTripNetBalances } from '../financial/calculator';
import { StorageService } from '../../infrastructure/storage';

export class TripService {
  static async createTrip(userId: string, input: CreateTripInput) {
    return prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          name: input.name,
          coverImageUrl: input.coverImageUrl || 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600',
          destination: input.destination,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : null,
          currency: input.currency || 'INR',
          status: 'ACTIVE',
          creatorId: userId,
          members: {
            create: {
              userId,
              role: 'CREATOR',
              status: 'ACTIVE',
              respondedAt: new Date(),
            },
          },
        },
        include: {
          members: {
            include: { user: true },
          },
        },
      });

      // Handle invitations
      if (input.initialInvitedUserIds && input.initialInvitedUserIds.length > 0) {
        for (const inviteeId of input.initialInvitedUserIds) {
          if (inviteeId === userId) continue;
          await tx.tripMember.create({
            data: {
              tripId: trip.id,
              userId: inviteeId,
              role: 'MEMBER',
              status: 'INVITED',
            },
          });

          // Create notification for invitee
          await tx.notification.create({
            data: {
              userId: inviteeId,
              tripId: trip.id,
              type: 'TRIP_INVITATION',
              title: `Invitation to ${trip.name}`,
              body: `You have been invited to join "${trip.name}".`,
              data: { tripId: trip.id },
            },
          });
        }
      }

      // Handle initial offline / dummy members atomically within the transaction
      if (input.initialDummyMembers && input.initialDummyMembers.length > 0) {
        for (const dm of input.initialDummyMembers) {
          const trimmedName = dm.name.trim();
          if (!trimmedName) continue;
          await tx.tripMember.create({
            data: {
              tripId: trip.id,
              userId: null,
              isDummy: true,
              role: 'MEMBER',
              status: 'ACTIVE',
              displayName: trimmedName,
              email: dm.email ? dm.email.toLowerCase().trim() : null,
              phone: dm.phone ? dm.phone.trim() : null,
              respondedAt: new Date(),
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          tripId: trip.id,
          action: 'CREATE_TRIP',
          entityType: 'TRIP',
          entityId: trip.id,
          details: { name: trip.name },
        },
      });

      return trip;
    });
  }

  static async getMyTrips(userId: string) {
    const memberships = await prisma.tripMember.findMany({
      where: {
        userId,
        status: { in: ['ACTIVE', 'LEFT'] },
      },
      include: {
        trip: {
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            members: {
              select: { id: true, status: true },
            },
            expenses: {
              where: { isDeleted: false },
              select: {
                id: true,
                payerMemberId: true,
                amountPaise: true,
                allocations: {
                  select: { memberId: true, sharePaise: true },
                },
              },
            },
            payments: {
              where: { status: 'CONFIRMED' },
              select: {
                id: true,
                payerMemberId: true,
                receiverMemberId: true,
                amountPaise: true,
              },
            },
            discounts: {
              where: { status: 'ACCEPTED' },
              select: {
                id: true,
                fromMemberId: true,
                toMemberId: true,
                waivedPaise: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let overallOwedToUserPaise = 0; // positive
    let overallUserOwesPaise = 0;    // positive magnitude

    const tripSummaries = memberships.map((m) => {
      const trip = m.trip;
      const allMemberIds = trip.members.map((mb) => mb.id);

      const netBalances = calculateTripNetBalances(
        allMemberIds,
        trip.expenses.map((e) => ({
          id: e.id,
          payerMemberId: e.payerMemberId,
          amountPaise: e.amountPaise,
          allocations: e.allocations.map((a) => ({
            memberId: a.memberId,
            sharePaise: a.sharePaise,
          })),
        })),
        trip.payments.map((p) => ({
          id: p.id,
          payerMemberId: p.payerMemberId,
          receiverMemberId: p.receiverMemberId,
          amountPaise: p.amountPaise,
        })),
        trip.discounts.map((d) => ({
          id: d.id,
          fromMemberId: d.fromMemberId,
          toMemberId: d.toMemberId,
          waivedPaise: d.waivedPaise,
        }))
      );

      const userBalance = netBalances.get(m.id)?.netBalancePaise || 0;

      if (userBalance > 0) {
        overallOwedToUserPaise += userBalance;
      } else if (userBalance < 0) {
        overallUserOwesPaise += Math.abs(userBalance);
      }

      // Latest activity timestamp
      const lastActivityAt = trip.updatedAt.toISOString();

      return {
        id: trip.id,
        name: trip.name,
        coverImageUrl: trip.coverImageUrl,
        destination: trip.destination,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate ? trip.endDate.toISOString() : null,
        currency: trip.currency,
        status: trip.status,
        creatorId: trip.creatorId,
        role: m.role,
        membershipStatus: m.status,
        memberCount: trip.members.filter((mb) => mb.status === 'ACTIVE').length,
        expenseCount: trip.expenses.length,
        userNetBalancePaise: userBalance,
        lastActivityAt,
        createdAt: trip.createdAt.toISOString(),
      };
    });

    return {
      trips: tripSummaries,
      aggregateNetPosition: {
        netOwedToUserPaise: overallOwedToUserPaise,
        netUserOwesPaise: overallUserOwesPaise,
        overallNetBalancePaise: overallOwedToUserPaise - overallUserOwesPaise,
        activeTripsCount: tripSummaries.filter((t) => t.status === 'ACTIVE').length,
      },
    };
  }

  static async getTripDetail(tripId: string, userId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, paymentQrUrl: true },
            },
          },
        },
        expenses: {
          where: { isDeleted: false },
          select: {
            id: true,
            payerMemberId: true,
            amountPaise: true,
            allocations: {
              select: { memberId: true, sharePaise: true },
            },
          },
        },
        payments: {
          where: { status: 'CONFIRMED' },
          select: {
            id: true,
            payerMemberId: true,
            receiverMemberId: true,
            amountPaise: true,
          },
        },
        discounts: {
          where: { status: 'ACCEPTED' },
          select: {
            id: true,
            fromMemberId: true,
            toMemberId: true,
            waivedPaise: true,
          },
        },
      },
    });

    if (!trip) throw new Error('Trip not found');

    const currentMember = trip.members.find((m) => m.userId === userId);
    if (!currentMember) {
      throw new Error('Forbidden: You are not a member of this trip');
    }

    const allMemberIds = trip.members.map((mb) => mb.id);
    const netBalances = calculateTripNetBalances(
      allMemberIds,
      trip.expenses.map((e) => ({
        id: e.id,
        payerMemberId: e.payerMemberId,
        amountPaise: e.amountPaise,
        allocations: e.allocations.map((a) => ({
          memberId: a.memberId,
          sharePaise: a.sharePaise,
        })),
      })),
      trip.payments.map((p) => ({
        id: p.id,
        payerMemberId: p.payerMemberId,
        receiverMemberId: p.receiverMemberId,
        amountPaise: p.amountPaise,
      })),
      trip.discounts.map((d) => ({
        id: d.id,
        fromMemberId: d.fromMemberId,
        toMemberId: d.toMemberId,
        waivedPaise: d.waivedPaise,
      }))
    );

    const totalExpensePaise = trip.expenses.reduce((acc, curr) => acc + curr.amountPaise, 0);
    const userNetBalancePaise = netBalances.get(currentMember.id)?.netBalancePaise || 0;

    return {
      id: trip.id,
      name: trip.name,
      coverImageUrl: trip.coverImageUrl,
      destination: trip.destination,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate ? trip.endDate.toISOString() : null,
      currency: trip.currency,
      status: trip.status,
      creatorId: trip.creatorId,
      role: currentMember.role,
      membershipStatus: currentMember.status,
      memberCount: trip.members.filter((m) => m.status === 'ACTIVE').length,
      expenseCount: trip.expenses.length,
      totalExpensePaise,
      userNetBalancePaise,
      currentMemberId: currentMember.id,
      creator: trip.creator,
      members: trip.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        tripId: m.tripId,
        role: m.role,
        status: m.status,
        isDummy: m.isDummy,
        displayName: m.displayName,
        email: m.email,
        phone: m.phone,
        joinedAt: m.respondedAt ? m.respondedAt.toISOString() : null,
        user: m.user || {
          id: m.id,
          name: m.displayName || 'Offline Member',
          email: m.email || '',
          phone: m.phone || null,
          avatarUrl: null,
          paymentQrUrl: null,
        },
        netBalancePaise: netBalances.get(m.id)?.netBalancePaise || 0,
      })),
      lastActivityAt: trip.updatedAt.toISOString(),
      createdAt: trip.createdAt.toISOString(),
    };
  }

  static async updateTrip(tripId: string, userId: string, input: UpdateTripInput) {
    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });

    if (!member || member.role !== 'CREATOR') {
      throw new Error('Forbidden: Only the trip creator can modify trip details');
    }

    const existingTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { coverImageUrl: true },
    });

    if (
      input.coverImageUrl !== undefined &&
      existingTrip?.coverImageUrl &&
      input.coverImageUrl !== existingTrip.coverImageUrl
    ) {
      await StorageService.deleteMediaByUrl(existingTrip.coverImageUrl);
    }

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.destination !== undefined ? { destination: input.destination } : {}),
        ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl } : {}),
        ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
      },
    });

    return updated;
  }

  static async closeTrip(tripId: string, userId: string) {
    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });

    if (!member || member.role !== 'CREATOR') {
      throw new Error('Forbidden: Only the trip creator can close the trip');
    }

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        tripId,
        action: 'CLOSE_TRIP',
        entityType: 'TRIP',
        entityId: tripId,
      },
    });

    return trip;
  }

  static async reopenTrip(tripId: string, userId: string) {
    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });

    if (!member || member.role !== 'CREATOR') {
      throw new Error('Forbidden: Only the trip creator can reopen the trip');
    }

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: 'ACTIVE',
        reopenedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        tripId,
        action: 'REOPEN_TRIP',
        entityType: 'TRIP',
        entityId: tripId,
      },
    });

    return trip;
  }

  static async leaveTrip(tripId: string, userId: string) {
    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
    });

    if (!member) throw new Error('Not a member of this trip');
    if (member.role === 'CREATOR') {
      throw new Error('Trip creator cannot leave the trip. You may close the trip instead.');
    }

    const updated = await prisma.tripMember.update({
      where: { id: member.id },
      data: {
        status: 'LEFT',
        leftAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        tripId,
        action: 'LEAVE_TRIP',
        entityType: 'TRIP_MEMBER',
        entityId: member.id,
      },
    });

    return updated;
  }
}

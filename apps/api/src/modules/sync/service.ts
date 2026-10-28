import { prisma } from '../../lib/prisma';
import { TripService } from '../trips/service';
import { SettlementService } from '../settlements/service';

export class SyncService {
  static async pullChanges(
    userId: string,
    lastSyncTimestamp?: string,
    requestedTripIds?: string[]
  ) {
    const sinceDate = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);
    const syncTime = new Date().toISOString();

    // 1. Fetch user's trips summary
    const myTripsResponse = await TripService.getMyTrips(userId);

    // 2. Determine target trips for detailed sync
    const targetTrips = requestedTripIds && requestedTripIds.length > 0
      ? myTripsResponse.trips.filter((t) => requestedTripIds.includes(t.id))
      : myTripsResponse.trips.slice(0, 5); // Default to first 5 active trips

    const activeTripDetails = await Promise.all(
      targetTrips.map(async (t) => {
        const [expenses, payments, settlementPlan] = await Promise.all([
          prisma.expense.findMany({
            where: {
              tripId: t.id,
              updatedAt: { gte: sinceDate },
            },
            include: {
              category: true,
              payerMember: { include: { user: true } },
              allocations: { include: { member: { include: { user: true } } } },
            },
          }),
          prisma.payment.findMany({
            where: {
              tripId: t.id,
              updatedAt: { gte: sinceDate },
            },
            include: {
              payerMember: { include: { user: true } },
              receiverMember: { include: { user: true } },
            },
          }),
          SettlementService.getSettlementPlan(t.id, userId),
        ]);

        return {
          tripId: t.id,
          expenses: expenses.map((e) => ({
            id: e.id,
            tripId: e.tripId,
            submitterId: e.submitterId,
            payerMemberId: e.payerMemberId,
            amountPaise: e.amountPaise,
            categoryId: e.categoryId,
            category: e.category,
            description: e.description,
            note: e.note,
            location: e.location,
            expenseDate: e.expenseDate.toISOString(),
            receiptUrl: e.receiptUrl,
            version: e.version,
            splitMethod: e.splitMethod,
            allocations: e.allocations.map((a) => ({
              id: a.id,
              memberId: a.memberId,
              sharePaise: a.sharePaise,
              member: a.member,
            })),
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
          })),
          payments: payments.map((p) => ({
            id: p.id,
            tripId: p.tripId,
            payerMemberId: p.payerMemberId,
            receiverMemberId: p.receiverMemberId,
            amountPaise: p.amountPaise,
            paymentMethod: p.paymentMethod,
            status: p.status,
            receiptUrl: p.receiptUrl,
            note: p.note,
            disputeReason: p.disputeReason,
            confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
            disputedAt: p.disputedAt ? p.disputedAt.toISOString() : null,
            cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            payerMember: p.payerMember,
            receiverMember: p.receiverMember,
          })),
          settlementPlan,
        };
      })
    );

    // 3. Fetch notifications updated/created since
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: sinceDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      lastSyncTimestamp: syncTime,
      trips: myTripsResponse.trips,
      aggregateNetPosition: myTripsResponse.aggregateNetPosition,
      activeTripDetails,
      notifications: notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        tripId: n.tripId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data as Record<string, unknown> | null,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }
}

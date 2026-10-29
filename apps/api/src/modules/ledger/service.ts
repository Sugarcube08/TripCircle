import { prisma } from '../../lib/prisma';

export class LedgerService {
  static async getTripLedger(tripId: string, currentUserId: string) {
    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: currentUserId } },
    });

    if (!member) throw new Error('Forbidden: Not a member of this trip');

    const entries = await prisma.ledgerEntry.findMany({
      where: { tripId },
      include: {
        member: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return entries;
  }

  static async getTripActivity(tripId: string, currentUserId: string) {
    const member = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: currentUserId } },
    });

    if (!member) throw new Error('Forbidden: Not a member of this trip');

    // Collect expenses, payments, revisions, discounts
    const [expenses, payments, revisions, discounts] = await Promise.all([
      prisma.expense.findMany({
        where: { tripId, isDeleted: false },
        include: {
          submitter: { select: { id: true, name: true, avatarUrl: true } },
          payerMember: { include: { user: true } },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.payment.findMany({
        where: { tripId },
        include: {
          payerMember: { include: { user: true } },
          receiverMember: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.expenseRevision.findMany({
        where: { expense: { tripId }, version: { gt: 1 } },
        include: {
          editor: { select: { id: true, name: true, avatarUrl: true } },
          expense: { select: { id: true, description: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.settlementDiscount.findMany({
        where: { tripId },
        include: {
          fromMember: { include: { user: true } },
          toMember: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    type ActivityItem = {
      id: string;
      type: 'EXPENSE_ADDED' | 'EXPENSE_EDITED' | 'PAYMENT_PENDING' | 'PAYMENT_CONFIRMED' | 'PAYMENT_DISPUTED' | 'DISCOUNT';
      title: string;
      description: string;
      actorName: string;
      actorAvatar?: string | null;
      timestamp: string;
      amountPaise?: number;
      metadata?: Record<string, unknown>;
    };

    const activities: ActivityItem[] = [];

    for (const e of expenses) {
      const payerName = e.payerMember.user?.name || e.payerMember.displayName || 'Offline Member';
      activities.push({
        id: `exp-${e.id}`,
        type: 'EXPENSE_ADDED',
        title: `Added expense: ${e.description}`,
        description: `${payerName} paid ₹${(e.amountPaise / 100).toFixed(2)} (${e.category.name})`,
        actorName: e.submitter.name,
        actorAvatar: e.submitter.avatarUrl,
        timestamp: e.createdAt.toISOString(),
        amountPaise: e.amountPaise,
        metadata: { expenseId: e.id },
      });
    }

    for (const r of revisions) {
      activities.push({
        id: `rev-${r.id}`,
        type: 'EXPENSE_EDITED',
        title: `Edited expense: ${r.expense.description}`,
        description: `${r.editor.name} updated the expense to ₹${(r.amountPaise / 100).toFixed(2)} (v${r.version})`,
        actorName: r.editor.name,
        actorAvatar: r.editor.avatarUrl,
        timestamp: r.createdAt.toISOString(),
        amountPaise: r.amountPaise,
        metadata: { expenseId: r.expenseId, version: r.version },
      });
    }

    for (const p of payments) {
      const payerName = p.payerMember.user?.name || p.payerMember.displayName || 'Offline Member';
      const receiverName = p.receiverMember.user?.name || p.receiverMember.displayName || 'Offline Member';
      let type: ActivityItem['type'] = 'PAYMENT_PENDING';
      let title = `Payment recorded: ₹${(p.amountPaise / 100).toFixed(2)}`;
      let desc = `${payerName} sent ₹${(p.amountPaise / 100).toFixed(2)} to ${receiverName} (${p.status})`;

      if (p.status === 'CONFIRMED') {
        type = 'PAYMENT_CONFIRMED';
        title = `Payment confirmed: ₹${(p.amountPaise / 100).toFixed(2)}`;
        desc = `${receiverName} confirmed receiving payment from ${payerName}`;
      } else if (p.status === 'DISPUTED') {
        type = 'PAYMENT_DISPUTED';
        title = `Payment disputed: ₹${(p.amountPaise / 100).toFixed(2)}`;
        desc = `${receiverName} disputed payment: "${p.disputeReason}"`;
      }

      activities.push({
        id: `pay-${p.id}`,
        type,
        title,
        description: desc,
        actorName: payerName,
        actorAvatar: p.payerMember.user?.avatarUrl || null,
        timestamp: p.updatedAt.toISOString(),
        amountPaise: p.amountPaise,
        metadata: { paymentId: p.id, status: p.status },
      });
    }

    for (const d of discounts) {
      const toMemberName = d.toMember.user?.name || d.toMember.displayName || 'Offline Member';
      const fromMemberName = d.fromMember.user?.name || d.fromMember.displayName || 'Offline Member';
      activities.push({
        id: `disc-${d.id}`,
        type: 'DISCOUNT',
        title: `Discount ${d.status.toLowerCase()}: ₹${(d.waivedPaise / 100).toFixed(2)}`,
        description: `${toMemberName} waived ₹${(d.waivedPaise / 100).toFixed(2)} for ${fromMemberName}: ${d.reason}`,
        actorName: toMemberName,
        actorAvatar: d.toMember.user?.avatarUrl || null,
        timestamp: d.createdAt.toISOString(),
        amountPaise: d.waivedPaise,
        metadata: { discountId: d.id, status: d.status },
      });
    }

    // Sort descending by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities;
  }
}

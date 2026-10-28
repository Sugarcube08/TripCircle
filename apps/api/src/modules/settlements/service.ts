import { prisma } from '../../lib/prisma';
import {
  calculateTripNetBalances,
  calculateSettlementPlan,
  calculateBilateralObligations,
} from '../financial/calculator';
import { ProposeDiscountInput, RespondDiscountInput } from '@tripcircle/contracts';
import { createOutboxEvent } from '../../lib/outbox';

export class SettlementService {
  static async getSettlementPlan(tripId: string, currentUserId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, paymentQrUrl: true } },
          },
        },
        expenses: {
          where: { isDeleted: false },
          include: { allocations: true },
        },
        payments: true,
        discounts: true,
      },
    });

    if (!trip) throw new Error('Trip not found');

    const currentMember = trip.members.find((m) => m.userId === currentUserId);
    if (!currentMember) {
      throw new Error('Forbidden: You are not a member of this trip');
    }

    const allMemberIds = trip.members.map((m) => m.id);
    const confirmedPayments = trip.payments.filter((p) => p.status === 'CONFIRMED');
    const acceptedDiscounts = trip.discounts.filter((d) => d.status === 'ACCEPTED');

    const pendingPaymentsCount = trip.payments.filter((p) => p.status === 'PENDING').length;
    const disputedPaymentsCount = trip.payments.filter((p) => p.status === 'DISPUTED').length;

    // Net balances calculation
    const netBalancesMap = calculateTripNetBalances(
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
      confirmedPayments.map((p) => ({
        id: p.id,
        payerMemberId: p.payerMemberId,
        receiverMemberId: p.receiverMemberId,
        amountPaise: p.amountPaise,
      })),
      acceptedDiscounts.map((d) => ({
        id: d.id,
        fromMemberId: d.fromMemberId,
        toMemberId: d.toMemberId,
        waivedPaise: d.waivedPaise,
      }))
    );

    // Simplified transfers
    const transfers = calculateSettlementPlan(netBalancesMap);

    // Member map for quick name resolution
    const memberObjMap = new Map(trip.members.map((m) => [m.id, m]));

    const simplifiedTransfers = transfers.map((t) => {
      const fromM = memberObjMap.get(t.fromMemberId);
      const toM = memberObjMap.get(t.toMemberId);
      return {
        fromMemberId: t.fromMemberId,
        fromUserId: fromM?.userId || '',
        fromUserName: fromM?.user.name || 'Unknown',
        toMemberId: t.toMemberId,
        toUserId: toM?.userId || '',
        toUserName: toM?.user.name || 'Unknown',
        amountPaise: t.amountPaise,
      };
    });

    // Bilateral obligations for current member
    const bilateralMap = calculateBilateralObligations(
      currentMember.id,
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
      confirmedPayments.map((p) => ({
        id: p.id,
        payerMemberId: p.payerMemberId,
        receiverMemberId: p.receiverMemberId,
        amountPaise: p.amountPaise,
      })),
      acceptedDiscounts.map((d) => ({
        id: d.id,
        fromMemberId: d.fromMemberId,
        toMemberId: d.toMemberId,
        waivedPaise: d.waivedPaise,
      }))
    );

    const bilateralObligations = Array.from(bilateralMap.entries()).map(([otherMemberId, amountPaise]) => {
      const otherM = memberObjMap.get(otherMemberId);
      return {
        otherMemberId,
        otherUserId: otherM?.userId || '',
        otherUserName: otherM?.user.name || 'Unknown',
        amountPaise, // positive: they owe current user; negative: current user owes them
      };
    });

    const memberBalancesList = Array.from(netBalancesMap.values()).map((state) => {
      const m = memberObjMap.get(state.memberId);
      return {
        ...state,
        userId: m?.userId || '',
        userName: m?.user.name || '',
        userAvatar: m?.user.avatarUrl,
      };
    });

    const isSettled = memberBalancesList.every((b) => b.netBalancePaise === 0);
    const totalTripExpensePaise = trip.expenses.reduce((acc, curr) => acc + curr.amountPaise, 0);

    return {
      tripId,
      currency: trip.currency,
      generatedAt: new Date().toISOString(),
      isSettled,
      currentUserNetBalancePaise: netBalancesMap.get(currentMember.id)?.netBalancePaise || 0,
      memberBalances: memberBalancesList,
      simplifiedTransfers,
      bilateralObligations,
      pendingPaymentsCount,
      disputedPaymentsCount,
      totalTripExpensePaise,
      discounts: trip.discounts,
    };
  }

  static async proposeDiscount(
    tripId: string,
    currentUserId: string,
    input: ProposeDiscountInput
  ) {
    return prisma.$transaction(async (tx) => {
      const fromMember = await tx.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId: currentUserId } },
        include: { user: true },
      });

      if (!fromMember) throw new Error('Not a member of this trip');

      const toMember = await tx.tripMember.findUnique({
        where: { id: input.toMemberId },
        include: { user: true },
      });

      if (!toMember || toMember.tripId !== tripId) {
        throw new Error('Invalid creditor: member not found in this trip');
      }

      const discount = await tx.settlementDiscount.create({
        data: {
          tripId,
          fromMemberId: fromMember.id,
          toMemberId: toMember.id,
          originalDebtPaise: input.originalDebtPaise,
          paidAmountPaise: input.paidAmountPaise,
          waivedPaise: input.waivedPaise,
          reason: input.reason,
          status: 'PENDING',
          paymentId: input.paymentId,
        },
        include: {
          fromMember: { include: { user: true } },
          toMember: { include: { user: true } },
        },
      });

      // Notify toMember (the creditor who must accept the discount)
      await tx.notification.create({
        data: {
          userId: toMember.userId,
          tripId,
          type: 'DISCOUNT_PROPOSED',
          title: `Settlement Discount Proposal: ₹${(discount.waivedPaise / 100).toFixed(2)}`,
          body: `${fromMember.user.name} proposed waiving ₹${(discount.waivedPaise / 100).toFixed(2)} for: "${discount.reason}". Please review and respond.`,
          data: { discountId: discount.id, tripId },
        },
      });

      await createOutboxEvent(tx, 'DISCOUNT', discount.id, 'DISCOUNT_PROPOSED', {
        discountId: discount.id,
        tripId,
        waivedPaise: discount.waivedPaise,
      });

      return discount;
    });
  }

  static async respondDiscount(
    tripId: string,
    discountId: string,
    currentUserId: string,
    input: RespondDiscountInput
  ) {
    return prisma.$transaction(async (tx) => {
      const discount = await tx.settlementDiscount.findUnique({
        where: { id: discountId },
        include: {
          fromMember: { include: { user: true } },
          toMember: { include: { user: true } },
        },
      });

      if (!discount || discount.tripId !== tripId) {
        throw new Error('Discount proposal not found');
      }

      if (discount.status !== 'PENDING') {
        throw new Error(`Discount is already ${discount.status}`);
      }

      // The creditor (toMember) must be the one responding
      if (discount.toMember.userId !== currentUserId) {
        throw new Error('Forbidden: Only the receiving creditor can accept or reject this discount');
      }

      const status = input.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

      const updated = await tx.settlementDiscount.update({
        where: { id: discount.id },
        data: {
          status,
          respondedAt: new Date(),
        },
        include: {
          fromMember: { include: { user: true } },
          toMember: { include: { user: true } },
        },
      });

      if (status === 'ACCEPTED') {
        // Record ledger entry
        await tx.ledgerEntry.create({
          data: {
            tripId,
            eventType: 'SETTLEMENT_DISCOUNT',
            referenceId: discount.id,
            memberId: discount.toMemberId,
            creditPaise: 0,
            debitPaise: discount.waivedPaise,
            netChangePaise: -discount.waivedPaise,
            balanceAfterPaise: 0,
            description: `Waived ₹${(discount.waivedPaise / 100).toFixed(2)} for ${discount.fromMember.user.name}: ${discount.reason}`,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            tripId,
            eventType: 'SETTLEMENT_DISCOUNT',
            referenceId: discount.id,
            memberId: discount.fromMemberId,
            creditPaise: discount.waivedPaise,
            debitPaise: 0,
            netChangePaise: discount.waivedPaise,
            balanceAfterPaise: 0,
            description: `Discount of ₹${(discount.waivedPaise / 100).toFixed(2)} accepted by ${discount.toMember.user.name}`,
          },
        });
      }

      // Notify fromMember
      await tx.notification.create({
        data: {
          userId: discount.fromMember.userId,
          tripId,
          type: 'DISCOUNT_RESPONSE',
          title: `Discount ${status.toLowerCase()}`,
          body: `${discount.toMember.user.name} has ${status.toLowerCase()}ed the discount waiver of ₹${(discount.waivedPaise / 100).toFixed(2)}.`,
          data: { discountId: discount.id, tripId },
        },
      });

      await createOutboxEvent(tx, 'DISCOUNT', discount.id, `DISCOUNT_${status}`, {
        discountId: discount.id,
        tripId,
        status,
      });

      return updated;
    });
  }
}

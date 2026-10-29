import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { ReportService } from '../../src/modules/reports/service';
import { NotificationService } from '../../src/modules/notifications/service';

describe('Report Export Engine & Notification Architecture Verification', () => {
  let exportUser: any;
  let exportTrip: any;
  let exportMember: any;
  let dummyMember: any;

  beforeAll(async () => {
    const timestamp = Date.now();
    exportUser = await prisma.user.create({
      data: {
        email: `export_user_${timestamp}@tripcircle.test`,
        name: 'Export Verification User',
        passwordHash: 'hashed_pw_test',
        isEmailVerified: true,
      },
    });

    const cat = await prisma.expenseCategory.findFirst();

    exportTrip = await prisma.trip.create({
      data: {
        name: 'Report & Notification Verification Trip',
        destination: 'Manali, India',
        startDate: new Date('2026-12-01'),
        currency: 'INR',
        status: 'ACTIVE',
        creatorId: exportUser.id,
      },
    });

    exportMember = await prisma.tripMember.create({
      data: {
        tripId: exportTrip.id,
        userId: exportUser.id,
        role: 'CREATOR',
        status: 'ACTIVE',
      },
    });

    dummyMember = await prisma.tripMember.create({
      data: {
        tripId: exportTrip.id,
        userId: null,
        displayName: 'Offline Traveler',
        isDummy: true,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
    });

    // Add an expense
    await prisma.expense.create({
      data: {
        tripId: exportTrip.id,
        submitterId: exportUser.id,
        payerMemberId: exportMember.id,
        amountPaise: 50000,
        categoryId: cat!.id,
        description: 'Mountain Resort Stay',
        splitMethod: 'EQUAL',
        version: 1,
        allocations: {
          create: [
            { memberId: exportMember.id, sharePaise: 25000 },
            { memberId: dummyMember.id, sharePaise: 25000 },
          ],
        },
      },
    });

    // Add an accepted discount
    await prisma.settlementDiscount.create({
      data: {
        tripId: exportTrip.id,
        fromMemberId: dummyMember.id,
        toMemberId: exportMember.id,
        originalDebtPaise: 50,
        paidAmountPaise: 0,
        waivedPaise: 50,
        reason: 'Waived sub-rupee residual settlement balance (< ₹1.00)',
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (exportTrip) {
      await prisma.settlementDiscount.deleteMany({ where: { tripId: exportTrip.id } });
      await prisma.expenseAllocation.deleteMany({ where: { expense: { tripId: exportTrip.id } } });
      await prisma.expense.deleteMany({ where: { tripId: exportTrip.id } });
      await prisma.notification.deleteMany({ where: { tripId: exportTrip.id } });
      await prisma.tripMember.deleteMany({ where: { tripId: exportTrip.id } });
      await prisma.trip.deleteMany({ where: { id: exportTrip.id } });
    }
    if (exportUser) {
      await prisma.pushDeviceToken.deleteMany({ where: { userId: exportUser.id } });
      await prisma.notification.deleteMany({ where: { userId: exportUser.id } });
      await prisma.user.deleteMany({ where: { id: exportUser.id } });
    }
  });

  describe('Report Generation & File Output', () => {
    it('1. Generates valid non-empty PDF Complete Trip Ledger report with discounts', async () => {
      const result = await ReportService.generateReport(exportTrip.id, exportUser.id, {
        reportType: 'TRIP_LEDGER',
        format: 'PDF',
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toContain('.pdf');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(1000); // Valid PDF with content
      // PDF starts with standard header %PDF-
      expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('2. Generates valid non-empty PDF Individual Member Statement report', async () => {
      const result = await ReportService.generateReport(exportTrip.id, exportUser.id, {
        reportType: 'INDIVIDUAL',
        format: 'PDF',
        memberId: exportMember.id,
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toContain('INDIVIDUAL');
      expect(result.buffer.length).toBeGreaterThan(1000);
      expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('3. Generates valid non-empty XLSX Excel Workbook with financial sheets', async () => {
      const result = await ReportService.generateReport(exportTrip.id, exportUser.id, {
        reportType: 'TRIP_LEDGER',
        format: 'XLSX',
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(result.filename).toContain('.xlsx');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(1000); // Non-empty XLSX zip archive
      // Zip header starts with PK\x03\x04
      expect(result.buffer.slice(0, 2).toString()).toBe('PK');
    });
  });

  describe('Notification Engine & Permissions', () => {
    it('4. Creates and lists user notifications with unread state', async () => {
      // Create test notifications
      await prisma.notification.create({
        data: {
          userId: exportUser.id,
          tripId: exportTrip.id,
          type: 'EXPENSE_ADDED',
          title: 'New Expense Added',
          body: 'Mountain Resort Stay of ₹500.00 was recorded.',
          isRead: false,
        },
      });

      await prisma.notification.create({
        data: {
          userId: exportUser.id,
          tripId: exportTrip.id,
          type: 'DISCOUNT_AUTO_WAIVED',
          title: 'Sub-Rupee Waiver',
          body: 'A residual balance of ₹0.50 was waived.',
          isRead: false,
        },
      });

      const list = await NotificationService.listNotifications(exportUser.id);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list[0].userId).toBe(exportUser.id);
      expect(list.some((n) => n.type === 'DISCOUNT_AUTO_WAIVED')).toBe(true);
    });

    it('5. Marks specific notification as read and marks all as read', async () => {
      const list = await NotificationService.listNotifications(exportUser.id);
      const unread = list.filter((n) => !n.isRead);
      expect(unread.length).toBeGreaterThan(0);

      // Mark single notification read
      await NotificationService.markAsRead(exportUser.id, unread[0].id);
      const afterSingle = await NotificationService.listNotifications(exportUser.id);
      const updatedSingle = afterSingle.find((n) => n.id === unread[0].id);
      expect(updatedSingle?.isRead).toBe(true);

      // Mark all read
      await NotificationService.markAsRead(exportUser.id);
      const afterAll = await NotificationService.listNotifications(exportUser.id);
      expect(afterAll.every((n) => n.isRead)).toBe(true);
    });

    it('6. Registers and updates push device tokens with unique constraint deduplication', async () => {
      const testToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
      const tokenRecord = await NotificationService.registerPushToken(
        exportUser.id,
        testToken,
        'android'
      );

      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.token).toBe(testToken);
      expect(tokenRecord.platform).toBe('android');

      // Idempotent re-registration updates timestamp without duplicate key error
      const tokenRecord2 = await NotificationService.registerPushToken(
        exportUser.id,
        testToken,
        'android'
      );
      expect(tokenRecord2.id).toBe(tokenRecord.id);

      const allTokens = await prisma.pushDeviceToken.findMany({
        where: { userId: exportUser.id },
      });
      expect(allTokens).toHaveLength(1);
    });
  });
});

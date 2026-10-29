import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import zlib from 'zlib';
import ExcelJS from 'exceljs';
import { prisma } from '../../src/lib/prisma';
import { ReportService } from '../../src/modules/reports/service';
import { NotificationService } from '../../src/modules/notifications/service';

function extractPdfText(buffer: Buffer): string {
  let fullText = '';
  const bufStr = buffer.toString('binary');
  let startIdx = 0;
  while ((startIdx = bufStr.indexOf('stream\n', startIdx)) !== -1) {
    const dataStart = startIdx + 7;
    const endIdx = bufStr.indexOf('\nendstream', dataStart);
    if (endIdx === -1) break;
    const streamBuf = buffer.subarray(dataStart, endIdx);
    startIdx = endIdx + 10;
    try {
      const decompressed = zlib.inflateSync(streamBuf).toString('latin1');
      const tjMatches = decompressed.match(/\[([\s\S]*?)\]\s*TJ/g) || [];
      for (const tj of tjMatches) {
        const hexMatches = tj.match(/<([0-9a-fA-F]+)>/g) || [];
        for (const h of hexMatches) {
          const clean = h.replace(/[<>]/g, '');
          fullText += Buffer.from(clean, 'hex').toString('utf8');
        }
        fullText += ' ';
      }
      const litMatches = decompressed.match(/\(([^)]+)\)/g) || [];
      for (const l of litMatches) {
        fullText += l.slice(1, -1) + ' ';
      }
    } catch {
      // Ignore uncompressed or non-zlib streams
    }
  }
  return fullText;
}

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

    // Add payments: CANCELLED, DISPUTED, CONFIRMED
    await prisma.payment.create({
      data: {
        tripId: exportTrip.id,
        payerMemberId: dummyMember.id,
        receiverMemberId: exportMember.id,
        amountPaise: 58600, // ₹586.00
        paymentMethod: 'CASH',
        status: 'CANCELLED',
      },
    });

    await prisma.payment.create({
      data: {
        tripId: exportTrip.id,
        payerMemberId: dummyMember.id,
        receiverMemberId: exportMember.id,
        amountPaise: 12000, // ₹120.00
        paymentMethod: 'UPI',
        status: 'DISPUTED',
        disputeReason: 'Payment not received in bank account',
        disputedAt: new Date(),
      },
    });

    await prisma.payment.create({
      data: {
        tripId: exportTrip.id,
        payerMemberId: dummyMember.id,
        receiverMemberId: exportMember.id,
        amountPaise: 20000, // ₹200.00
        paymentMethod: 'UPI',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
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
      await prisma.payment.deleteMany({ where: { tripId: exportTrip.id } });
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
    it('1. Generates valid non-empty PDF Complete Trip Ledger report with discounts and ASCII currency', async () => {
      const result = await ReportService.generateReport(exportTrip.id, exportUser.id, {
        reportType: 'TRIP_LEDGER',
        format: 'PDF',
        includeReceipts: false,
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toContain('.pdf');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(1000);
      // PDF starts with standard header %PDF-
      expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');

      // Verify that unencoded raw Unicode rupee glyph (\u20B9) is NOT in the PDF
      // which would cause font corruptions in Type-1 Helvetica
      expect(result.buffer.includes(Buffer.from('₹'))).toBe(false);

      const text = extractPdfText(result.buffer);

      // Verify CANCELLED status text is present in the PDF output
      expect(text).toContain('CANCELLED');
      expect(text).toContain('Cancelled');

      // Verify DISPUTED status text and dispute reason are present
      expect(text).toContain('DISPUTED');
      expect(text).toContain('Payment not received in bank account');

      // Verify CONFIRMED status text is present
      expect(text).toContain('CONFIRMED');
    });

    it('2. Generates valid non-empty PDF Individual Member Statement report', async () => {
      const result = await ReportService.generateReport(exportTrip.id, exportUser.id, {
        reportType: 'INDIVIDUAL',
        format: 'PDF',
        memberId: exportMember.id,
        includeReceipts: false,
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toContain('INDIVIDUAL');
      expect(result.buffer.length).toBeGreaterThan(1000);
      expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');

      const text = extractPdfText(result.buffer);
      expect(text).toContain('Individual Member Statement');
      expect(text).toContain('Export Verification User');
    });

    it('3. Generates valid non-empty XLSX Excel Workbook with 5 financial sheets', async () => {
      const result = await ReportService.generateReport(exportTrip.id, exportUser.id, {
        reportType: 'TRIP_LEDGER',
        format: 'XLSX',
        includeReceipts: false,
      });

      expect(result).toBeDefined();
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(result.filename).toContain('.xlsx');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(1000);
      // Zip header starts with PK\x03\x04
      expect(result.buffer.slice(0, 2).toString()).toBe('PK');

      // Parse the generated XLSX workbook to verify sheets and rows
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer as any);

      const sheetNames = workbook.worksheets.map((s) => s.name);
      expect(sheetNames).toContain('Summary & Balances');
      expect(sheetNames).toContain('Expenses');
      expect(sheetNames).toContain('Payments');
      expect(sheetNames).toContain('Settlement Plan');
      expect(sheetNames).toContain('Discounts & Waivers');

      // Check Payments sheet contains CANCELLED payment with exact status
      const paymentSheet = workbook.getWorksheet('Payments')!;
      let foundCancelled = false;
      let foundDisputed = false;
      paymentSheet.eachRow((row) => {
        const values = row.values as any[];
        if (values.includes('CANCELLED')) {
          foundCancelled = true;
        }
        if (values.includes('DISPUTED')) {
          foundDisputed = true;
        }
      });
      expect(foundCancelled).toBe(true);
      expect(foundDisputed).toBe(true);

      // Check Discounts & Waivers sheet contains the 50 paise waiver
      const discountSheet = workbook.getWorksheet('Discounts & Waivers')!;
      let foundDiscount = false;
      discountSheet.eachRow((row) => {
        const values = row.values as any[];
        if (values.includes('0.50') || values.includes('ACCEPTED')) {
          foundDiscount = true;
        }
      });
      expect(foundDiscount).toBe(true);
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
          body: 'Mountain Resort Stay of INR 500.00 was recorded.',
          isRead: false,
        },
      });

      await prisma.notification.create({
        data: {
          userId: exportUser.id,
          tripId: exportTrip.id,
          type: 'DISCOUNT_AUTO_WAIVED',
          title: 'Sub-Rupee Waiver',
          body: 'A residual balance of INR 0.50 was waived.',
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

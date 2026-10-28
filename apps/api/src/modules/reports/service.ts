import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma';
import { calculateTripNetBalances, calculateSettlementPlan } from '../financial/calculator';
import { ExportReportInput } from '@tripcircle/contracts';

export class ReportService {
  static async generateReport(tripId: string, currentUserId: string, input: ExportReportInput) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        creator: true,
        members: { include: { user: true } },
        expenses: {
          where: { isDeleted: false },
          include: {
            category: true,
            payerMember: { include: { user: true } },
            allocations: { include: { member: { include: { user: true } } } },
          },
          orderBy: { expenseDate: 'asc' },
        },
        payments: {
          include: {
            payerMember: { include: { user: true } },
            receiverMember: { include: { user: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        discounts: {
          include: {
            fromMember: { include: { user: true } },
            toMember: { include: { user: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!trip) throw new Error('Trip not found');

    const currentMember = trip.members.find((m) => m.userId === currentUserId);
    if (!currentMember) throw new Error('Forbidden: Not a member of this trip');

    const allMemberIds = trip.members.map((m) => m.id);
    const confirmedPayments = trip.payments.filter((p) => p.status === 'CONFIRMED');
    const pendingOrDisputedPayments = trip.payments.filter((p) => p.status !== 'CONFIRMED');
    const acceptedDiscounts = trip.discounts.filter((d) => d.status === 'ACCEPTED');

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

    const settlementTransfers = calculateSettlementPlan(netBalances);
    const memberMap = new Map(trip.members.map((m) => [m.id, m]));

    if (input.format === 'PDF') {
      return this.generatePdfReport(trip, currentMember, netBalances, settlementTransfers, memberMap, input);
    } else {
      return this.generateExcelReport(trip, currentMember, netBalances, settlementTransfers, memberMap, input);
    }
  }

  private static async generatePdfReport(
    trip: any,
    currentMember: any,
    netBalances: Map<string, any>,
    settlementTransfers: any[],
    memberMap: Map<string, any>,
    input: ExportReportInput
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const filename = `${trip.name.replace(/\s+/g, '_')}_${input.reportType}_Report.pdf`;
        resolve({ buffer, contentType: 'application/pdf', filename });
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(22).font('Helvetica-Bold').text('TripCircle Financial Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica-Bold').text(`Trip: ${trip.name}`, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(
        `Destination: ${trip.destination || 'N/A'} | Currency: ${trip.currency} | Status: ${trip.status}`,
        { align: 'center' }
      );
      doc.fontSize(9).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()} (Exact Paise Accounting)`, { align: 'center' });
      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(1);

      if (input.reportType === 'INDIVIDUAL') {
        const targetMemberId = input.memberId || currentMember.id;
        const targetMember = memberMap.get(targetMemberId) || currentMember;
        const state = netBalances.get(targetMember.id);

        doc.fontSize(14).font('Helvetica-Bold').text(`Individual Statement: ${targetMember.user.name}`);
        doc.moveDown(0.5);

        const net = state?.netBalancePaise || 0;
        const netStr = `₹${(Math.abs(net) / 100).toFixed(2)}`;
        const netStatus = net > 0 ? `YOU ARE OWED ${netStr}` : net < 0 ? `YOU OWE ${netStr}` : `SETTLED (₹0.00)`;

        doc.fontSize(11).font('Helvetica-Bold').text(`Net Position: ${netStatus}`);
        doc.fontSize(10).font('Helvetica').text(`Total Paid for Expenses: ₹${((state?.totalPaidPaise || 0) / 100).toFixed(2)}`);
        doc.fontSize(10).font('Helvetica').text(`Total Expense Share (Debits): ₹${((state?.totalExpenseSharePaise || 0) / 100).toFixed(2)}`);
        doc.fontSize(10).font('Helvetica').text(`Confirmed Payments Made: ₹${((state?.paymentsMadePaise || 0) / 100).toFixed(2)}`);
        doc.fontSize(10).font('Helvetica').text(`Confirmed Payments Received: ₹${((state?.paymentsReceivedPaise || 0) / 100).toFixed(2)}`);
        doc.fontSize(10).font('Helvetica').text(`Discounts Given (Waived): ₹${((state?.discountsGivenPaise || 0) / 100).toFixed(2)}`);
        doc.fontSize(10).font('Helvetica').text(`Discounts Received: ₹${((state?.discountsReceivedPaise || 0) / 100).toFixed(2)}`);
        doc.moveDown(1);
      } else {
        // Complete Trip Report
        doc.fontSize(14).font('Helvetica-Bold').text('Group Financial Summary & Balances');
        doc.moveDown(0.5);

        for (const [mId, b] of netBalances.entries()) {
          const m = memberMap.get(mId);
          const pos = b.netBalancePaise > 0
            ? `+₹${(b.netBalancePaise / 100).toFixed(2)} (Owed)`
            : b.netBalancePaise < 0
              ? `-₹${(Math.abs(b.netBalancePaise) / 100).toFixed(2)} (Owes)`
              : '₹0.00 (Settled)';

          doc.fontSize(10).font('Helvetica').text(
            `• ${m?.user.name}: Paid ₹${(b.totalPaidPaise / 100).toFixed(2)} | Share ₹${(b.totalExpenseSharePaise / 100).toFixed(2)} | Net: ${pos}`
          );
        }
        doc.moveDown(1);

        // Recommended Settlement Plan
        doc.fontSize(14).font('Helvetica-Bold').text('Recommended Settlement Transfers');
        doc.moveDown(0.5);
        if (settlementTransfers.length === 0) {
          doc.fontSize(10).font('Helvetica').text('All balances are fully settled! No transfers required.');
        } else {
          for (const t of settlementTransfers) {
            const fromName = memberMap.get(t.fromMemberId)?.user.name;
            const toName = memberMap.get(t.toMemberId)?.user.name;
            doc.fontSize(10).font('Helvetica').text(`• ${fromName} should pay ${toName}: ₹${(t.amountPaise / 100).toFixed(2)}`);
          }
        }
        doc.moveDown(1);
      }

      // Expenses Table
      doc.fontSize(14).font('Helvetica-Bold').text('Expense Transactions');
      doc.moveDown(0.5);

      for (const e of trip.expenses) {
        const dateStr = new Date(e.expenseDate).toLocaleDateString();
        doc.fontSize(10).font('Helvetica-Bold').text(
          `${dateStr} — ${e.description}: ₹${(e.amountPaise / 100).toFixed(2)} (${e.category.name})`
        );
        doc.fontSize(9).font('Helvetica').text(`  Paid by: ${e.payerMember.user.name} | Method: ${e.splitMethod}`);
        const shares = e.allocations.map((a: any) => `${a.member.user.name}: ₹${(a.sharePaise / 100).toFixed(2)}`).join(', ');
        doc.fontSize(9).font('Helvetica').text(`  Shares: ${shares}`);
        doc.moveDown(0.3);
      }
      doc.moveDown(1);

      // Payments Table (Confirmed vs Pending/Disputed)
      doc.fontSize(14).font('Helvetica-Bold').text('Payments & Confirmations');
      doc.moveDown(0.5);

      if (trip.payments.length === 0) {
        doc.fontSize(10).font('Helvetica').text('No payment transfers recorded.');
      } else {
        for (const p of trip.payments) {
          const statusText = p.status === 'CONFIRMED' ? '[CONFIRMED]' : p.status === 'DISPUTED' ? '[DISPUTED]' : '[PENDING]';
          doc.fontSize(10).font('Helvetica').text(
            `${statusText} ${p.payerMember.user.name} -> ${p.receiverMember.user.name}: ₹${(p.amountPaise / 100).toFixed(2)} (${p.paymentMethod})`
          );
          if (p.disputeReason) {
            doc.fontSize(9).font('Helvetica-Oblique').text(`  Dispute reason: ${p.disputeReason}`);
          }
        }
      }

      doc.end();
    });
  }

  private static async generateExcelReport(
    trip: any,
    currentMember: any,
    netBalances: Map<string, any>,
    settlementTransfers: any[],
    memberMap: Map<string, any>,
    input: ExportReportInput
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TripCircle';
    workbook.created = new Date();

    // Sheet 1: Summary & Balances
    const summarySheet = workbook.addWorksheet('Summary & Balances');
    summarySheet.columns = [
      { header: 'Member Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Total Paid (₹)', key: 'totalPaid', width: 16 },
      { header: 'Expense Share (₹)', key: 'share', width: 18 },
      { header: 'Payments Made (₹)', key: 'paymentsMade', width: 18 },
      { header: 'Payments Received (₹)', key: 'paymentsReceived', width: 20 },
      { header: 'Discounts Received (₹)', key: 'discountsReceived', width: 20 },
      { header: 'Discounts Given (₹)', key: 'discountsGiven', width: 20 },
      { header: 'Net Balance (₹)', key: 'netBalance', width: 18 },
      { header: 'Status', key: 'status', width: 18 },
    ];

    for (const [mId, b] of netBalances.entries()) {
      const m = memberMap.get(mId);
      summarySheet.addRow({
        name: m?.user.name,
        email: m?.user.email,
        totalPaid: (b.totalPaidPaise / 100).toFixed(2),
        share: (b.totalExpenseSharePaise / 100).toFixed(2),
        paymentsMade: (b.paymentsMadePaise / 100).toFixed(2),
        paymentsReceived: (b.paymentsReceivedPaise / 100).toFixed(2),
        discountsReceived: (b.discountsReceivedPaise / 100).toFixed(2),
        discountsGiven: (b.discountsGivenPaise / 100).toFixed(2),
        netBalance: (b.netBalancePaise / 100).toFixed(2),
        status: b.netBalancePaise > 0 ? 'Owed Money' : b.netBalancePaise < 0 ? 'Owes Money' : 'Settled',
      });
    }

    // Sheet 2: Expenses
    const expenseSheet = workbook.addWorksheet('Expenses');
    expenseSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Description', key: 'desc', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount (₹)', key: 'amount', width: 15 },
      { header: 'Paid By', key: 'payer', width: 20 },
      { header: 'Split Method', key: 'method', width: 15 },
      { header: 'Location', key: 'location', width: 20 },
    ];

    for (const e of trip.expenses) {
      expenseSheet.addRow({
        date: new Date(e.expenseDate).toLocaleDateString(),
        desc: e.description,
        category: e.category.name,
        amount: (e.amountPaise / 100).toFixed(2),
        payer: e.payerMember.user.name,
        method: e.splitMethod,
        location: e.location || 'N/A',
      });
    }

    // Sheet 3: Payments
    const paymentSheet = workbook.addWorksheet('Payments');
    paymentSheet.columns = [
      { header: 'Payer', key: 'payer', width: 20 },
      { header: 'Receiver', key: 'receiver', width: 20 },
      { header: 'Amount (₹)', key: 'amount', width: 15 },
      { header: 'Method', key: 'method', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Dispute Reason', key: 'dispute', width: 30 },
      { header: 'Date', key: 'date', width: 18 },
    ];

    for (const p of trip.payments) {
      paymentSheet.addRow({
        payer: p.payerMember.user.name,
        receiver: p.receiverMember.user.name,
        amount: (p.amountPaise / 100).toFixed(2),
        method: p.paymentMethod,
        status: p.status,
        dispute: p.disputeReason || '',
        date: new Date(p.createdAt).toLocaleString(),
      });
    }

    // Sheet 4: Settlement Transfers
    const settlementSheet = workbook.addWorksheet('Settlement Plan');
    settlementSheet.columns = [
      { header: 'From (Debtor)', key: 'from', width: 25 },
      { header: 'To (Creditor)', key: 'to', width: 25 },
      { header: 'Recommended Transfer (₹)', key: 'amount', width: 25 },
    ];

    for (const t of settlementTransfers) {
      settlementSheet.addRow({
        from: memberMap.get(t.fromMemberId)?.user.name,
        to: memberMap.get(t.toMemberId)?.user.name,
        amount: (t.amountPaise / 100).toFixed(2),
      });
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    const filename = `${trip.name.replace(/\s+/g, '_')}_Report.xlsx`;

    return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename };
  }
}

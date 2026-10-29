import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma';
import { calculateTripNetBalances, calculateSettlementPlan } from '../financial/calculator';
import { ExportReportInput } from '@tripcircle/contracts';

/**
 * Format integer paise into standard Indian Rupee string without raw Unicode glyphs
 * to ensure 100% compatibility with standard PDFKit fonts (WinAnsiEncoding).
 */
function formatINR(paise: number): string {
  const isNegative = paise < 0;
  const absRupees = (Math.abs(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}INR ${absRupees}`;
}

/**
 * Sanitize arbitrary text to ensure no unencoded Unicode currency symbols
 * like ₹ break WinAnsiEncoding in PDFKit Helvetica fonts.
 */
function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/₹/g, 'INR ');
}

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
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const filename = `${trip.name.replace(/\s+/g, '_')}_${input.reportType}_Report.pdf`;
        resolve({ buffer, contentType: 'application/pdf', filename });
      });
      doc.on('error', reject);

      const contentWidth = 515; // 595 - 80 margin

      const ensureSpace = (neededHeight: number) => {
        if (doc.y + neededHeight > doc.page.height - 50) {
          doc.addPage();
        }
      };

      const drawSectionTitle = (title: string) => {
        ensureSpace(40);
        doc.moveDown(0.8);
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text(title);
        doc.moveDown(0.2);
        doc.moveTo(40, doc.y).lineTo(40 + contentWidth, doc.y).strokeColor('#CBD5E1').lineWidth(1).stroke();
        doc.moveDown(0.5);
      };

      // ----------------------------------------------------
      // SECTION 1: HEADER & TRIP METADATA
      // ----------------------------------------------------
      doc.rect(40, 40, contentWidth, 4).fill('#2563EB');
      doc.y = 52;

      doc.fontSize(20).font('Helvetica-Bold').fillColor('#0F172A').text('TRIPCIRCLE FINANCIAL STATEMENT', { align: 'center' });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#2563EB').text(`Trip: ${sanitizeText(trip.name)}`, { align: 'center' });

      const dateRangeStr = trip.startDate
        ? `${new Date(trip.startDate).toLocaleDateString('en-IN')}${trip.endDate ? ` to ${new Date(trip.endDate).toLocaleDateString('en-IN')}` : ''}`
        : 'Ongoing';

      doc.fontSize(9).font('Helvetica').fillColor('#475569').text(
        `Destination: ${sanitizeText(trip.destination || 'N/A')}  |  Dates: ${dateRangeStr}  |  Currency: ${trip.currency || 'INR'}  |  Status: ${trip.status}`,
        { align: 'center' }
      );
      doc.fontSize(8).font('Helvetica').fillColor('#64748B').text(
        `Generated: ${new Date().toLocaleString('en-IN')}  |  Scope: ${input.reportType === 'INDIVIDUAL' ? 'Individual Member Statement' : 'Full Trip Ledger'}  |  Trip ID: ${trip.id}`,
        { align: 'center' }
      );
      doc.moveDown(0.8);
      doc.moveTo(40, doc.y).lineTo(40 + contentWidth, doc.y).strokeColor('#E2E8F0').lineWidth(0.75).stroke();
      doc.moveDown(0.5);

      // ----------------------------------------------------
      // SECTION 2: GROUP FINANCIAL SUMMARY
      // ----------------------------------------------------
      const totalExpensePaise = trip.expenses.reduce((sum: number, e: any) => sum + e.amountPaise, 0);
      const confirmedPayments = trip.payments.filter((p: any) => p.status === 'CONFIRMED');
      const totalConfirmedPaymentPaise = confirmedPayments.reduce((sum: number, p: any) => sum + p.amountPaise, 0);
      const acceptedDiscounts = trip.discounts.filter((d: any) => d.status === 'ACCEPTED');
      const totalDiscountPaise = acceptedDiscounts.reduce((sum: number, d: any) => sum + d.waivedPaise, 0);

      drawSectionTitle('1. Group Financial Overview');

      const summaryBoxY = doc.y;
      doc.rect(40, summaryBoxY, contentWidth, 44).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#0F172A');

      const colW = contentWidth / 4;
      doc.fontSize(8).font('Helvetica').fillColor('#64748B');
      doc.text('TOTAL GROUP SPEND', 48, summaryBoxY + 8, { width: colW - 16 });
      doc.text('SETTLEMENTS PAID', 48 + colW, summaryBoxY + 8, { width: colW - 16 });
      doc.text('WAIVED DISCOUNTS', 48 + colW * 2, summaryBoxY + 8, { width: colW - 16 });
      doc.text('SETTLEMENT HEALTH', 48 + colW * 3, summaryBoxY + 8, { width: colW - 16 });

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A');
      doc.text(formatINR(totalExpensePaise), 48, summaryBoxY + 22, { width: colW - 16 });
      doc.text(formatINR(totalConfirmedPaymentPaise), 48 + colW, summaryBoxY + 22, { width: colW - 16 });
      doc.text(formatINR(totalDiscountPaise), 48 + colW * 2, summaryBoxY + 22, { width: colW - 16 });
      doc.fillColor(settlementTransfers.length === 0 ? '#059669' : '#2563EB');
      doc.text(settlementTransfers.length === 0 ? 'All Settled' : `${settlementTransfers.length} Pending Transfers`, 48 + colW * 3, summaryBoxY + 22, { width: colW - 16 });

      doc.y = summaryBoxY + 52;

      // ----------------------------------------------------
      // SECTION 3: MEMBER-WISE BALANCES
      // ----------------------------------------------------
      if (input.reportType === 'INDIVIDUAL') {
        const targetMemberId = input.memberId || currentMember.id;
        const targetMember = memberMap.get(targetMemberId) || currentMember;
        const targetMemberName = sanitizeText(targetMember.user?.name || targetMember.displayName || 'Offline Member');
        const targetMemberEmail = targetMember.user?.email || targetMember.email || 'N/A';
        const state = netBalances.get(targetMember.id) || {
          netBalancePaise: 0,
          totalPaidPaise: 0,
          totalExpenseSharePaise: 0,
          paymentsMadePaise: 0,
          paymentsReceivedPaise: 0,
          discountsGivenPaise: 0,
          discountsReceivedPaise: 0,
        };

        drawSectionTitle(`2. Individual Member Statement: ${targetMemberName}`);

        const net = state.netBalancePaise;
        const netStr = formatINR(Math.abs(net));
        const netColor = net > 0 ? '#059669' : net < 0 ? '#DC2626' : '#475569';
        const netStatus = net > 0 ? `YOU ARE OWED ${netStr}` : net < 0 ? `YOU OWE ${netStr}` : 'FULLY SETTLED (INR 0.00)';

        ensureSpace(120);
        const cardY = doc.y;
        doc.rect(40, cardY, contentWidth, 105).fillAndStroke('#F1F5F9', '#CBD5E1');

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text(`Account: ${targetMemberName} (${targetMemberEmail})`, 52, cardY + 10);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(netColor).text(`Net Financial Position: ${netStatus}`, 52, cardY + 26);

        doc.fontSize(9).font('Helvetica').fillColor('#334155');
        doc.text(`Total Paid for Expenses: ${formatINR(state.totalPaidPaise)}`, 52, cardY + 46);
        doc.text(`Total Expense Share (Debits): ${formatINR(state.totalExpenseSharePaise)}`, 52, cardY + 60);
        doc.text(`Confirmed Payments Made: ${formatINR(state.paymentsMadePaise)}`, 52, cardY + 74);
        doc.text(`Confirmed Payments Received: ${formatINR(state.paymentsReceivedPaise)}`, 52, cardY + 88);

        doc.text(`Discounts Given (Waived): ${formatINR(state.discountsGivenPaise)}`, 300, cardY + 46);
        doc.text(`Discounts Received: ${formatINR(state.discountsReceivedPaise)}`, 300, cardY + 60);

        doc.y = cardY + 115;
      } else {
        drawSectionTitle('2. Member-wise Net Balances');

        ensureSpace(30);
        // Table Header
        const thY = doc.y;
        doc.rect(40, thY, contentWidth, 18).fill('#0F172A');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('MEMBER', 46, thY + 5, { width: 130 });
        doc.text('PAID', 180, thY + 5, { width: 65, align: 'right' });
        doc.text('SHARE', 250, thY + 5, { width: 65, align: 'right' });
        doc.text('PAYMENTS', 320, thY + 5, { width: 75, align: 'right' });
        doc.text('DISCOUNTS', 400, thY + 5, { width: 65, align: 'right' });
        doc.text('NET BALANCE', 470, thY + 5, { width: 80, align: 'right' });

        doc.y = thY + 20;

        let rowIndex = 0;
        for (const [mId, b] of netBalances.entries()) {
          ensureSpace(20);
          const m = memberMap.get(mId);
          const mName = sanitizeText(m?.user?.name || m?.displayName || 'Offline Member');
          const rowY = doc.y;

          if (rowIndex % 2 === 1) {
            doc.rect(40, rowY, contentWidth, 18).fill('#F8FAFC');
          }

          const net = b.netBalancePaise;
          const netColor = net > 0 ? '#059669' : net < 0 ? '#DC2626' : '#475569';
          const netLabel = net > 0 ? `+${formatINR(net)}` : net < 0 ? formatINR(net) : 'INR 0.00';
          const netPayments = b.paymentsMadePaise - b.paymentsReceivedPaise;
          const netDiscounts = b.discountsGivenPaise - b.discountsReceivedPaise;

          doc.fontSize(8).font('Helvetica').fillColor('#0F172A').text(mName, 46, rowY + 5, { width: 130, ellipsis: true });
          doc.text(formatINR(b.totalPaidPaise), 180, rowY + 5, { width: 65, align: 'right' });
          doc.text(formatINR(b.totalExpenseSharePaise), 250, rowY + 5, { width: 65, align: 'right' });
          doc.text(formatINR(netPayments), 320, rowY + 5, { width: 75, align: 'right' });
          doc.text(formatINR(netDiscounts), 400, rowY + 5, { width: 65, align: 'right' });
          doc.font('Helvetica-Bold').fillColor(netColor).text(netLabel, 470, rowY + 5, { width: 80, align: 'right' });

          doc.y = rowY + 18;
          rowIndex++;
        }
        doc.moveDown(0.5);
      }

      // ----------------------------------------------------
      // SECTION 4: RECOMMENDED SETTLEMENT TRANSFERS
      // ----------------------------------------------------
      drawSectionTitle('3. Recommended Settlement Transfers (Simplified Greedy Routing)');

      if (settlementTransfers.length === 0) {
        ensureSpace(25);
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#059669').text(
          'All member balances are fully settled! No cash or UPI transfers required.',
          48,
          doc.y
        );
        doc.moveDown(0.5);
      } else {
        ensureSpace(20);
        for (const t of settlementTransfers) {
          ensureSpace(22);
          const fromName = sanitizeText(memberMap.get(t.fromMemberId)?.user?.name || memberMap.get(t.fromMemberId)?.displayName || 'Offline Member');
          const toName = sanitizeText(memberMap.get(t.toMemberId)?.user?.name || memberMap.get(t.toMemberId)?.displayName || 'Offline Member');
          const transferY = doc.y;

          doc.rect(40, transferY, contentWidth, 20).fillAndStroke('#FEF3C7', '#FDE68A');
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#92400E').text(
            `Transfer: ${fromName} -> pays -> ${toName} : ${formatINR(t.amountPaise)}`,
            48,
            transferY + 5
          );
          doc.y = transferY + 24;
        }
        doc.moveDown(0.5);
      }

      // ----------------------------------------------------
      // SECTION 5: DETAILED EXPENSE LEDGER
      // ----------------------------------------------------
      drawSectionTitle(`4. Detailed Expense Ledger (${trip.expenses.length} Records)`);

      if (trip.expenses.length === 0) {
        ensureSpace(20);
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748B').text('No expenses recorded for this trip.');
      } else {
        let eIdx = 0;
        for (const e of trip.expenses) {
          ensureSpace(34);
          const eY = doc.y;
          const isEven = eIdx % 2 === 0;

          doc.rect(40, eY, contentWidth, 32).fill(isEven ? '#FFFFFF' : '#F8FAFC');
          doc.moveTo(40, eY + 32).lineTo(40 + contentWidth, eY + 32).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

          const dateStr = new Date(e.expenseDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const payerName = sanitizeText(e.payerMember.user?.name || e.payerMember.displayName || 'Offline Member');
          const desc = sanitizeText(e.description);
          const cat = sanitizeText(e.category?.name || 'General');

          // Line 1: Date | Description (Category) ... Amount
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(
            `${dateStr} — ${desc} (${cat})`,
            46,
            eY + 4,
            { width: 360, ellipsis: true }
          );
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(
            formatINR(e.amountPaise),
            410,
            eY + 4,
            { width: 140, align: 'right' }
          );

          // Line 2: Paid by ... Allocations
          const sharesList = e.allocations
            .map((a: any) => `${sanitizeText(a.member.user?.name || a.member.displayName || 'Member')}: ${formatINR(a.sharePaise)}`)
            .join(', ');

          doc.fontSize(8).font('Helvetica').fillColor('#64748B').text(
            `Paid by: ${payerName} [${e.splitMethod}]  |  Shares: ${sharesList}`,
            46,
            eY + 18,
            { width: 504, ellipsis: true }
          );

          doc.y = eY + 34;
          eIdx++;
        }
      }
      doc.moveDown(0.5);

      // ----------------------------------------------------
      // SECTION 6: PAYMENTS & TRANSFERS LEDGER
      // ----------------------------------------------------
      drawSectionTitle(`5. Payments & Confirmations Ledger (${trip.payments.length} Records)`);

      if (trip.payments.length === 0) {
        ensureSpace(20);
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748B').text('No settlement payments recorded.');
      } else {
        let pIdx = 0;
        for (const p of trip.payments) {
          ensureSpace(32);
          const pY = doc.y;

          // Status representation covering all 4 enum values:
          // CONFIRMED, PENDING, DISPUTED, CANCELLED
          let statusLabel = `[${p.status}]`;
          let statusBg = '#E2E8F0';
          let statusTextColor = '#475569';

          if (p.status === 'CONFIRMED') {
            statusBg = '#DCFCE7';
            statusTextColor = '#15803D';
          } else if (p.status === 'DISPUTED') {
            statusBg = '#FEE2E2';
            statusTextColor = '#B91C1C';
          } else if (p.status === 'PENDING') {
            statusBg = '#FEF3C7';
            statusTextColor = '#B45309';
          } else if (p.status === 'CANCELLED') {
            statusBg = '#F1F5F9';
            statusTextColor = '#64748B';
          }

          doc.rect(40, pY, contentWidth, 30).fill(pIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
          doc.moveTo(40, pY + 30).lineTo(40 + contentWidth, pY + 30).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

          const payerName = sanitizeText(p.payerMember.user?.name || p.payerMember.displayName || 'Offline Member');
          const receiverName = sanitizeText(p.receiverMember.user?.name || p.receiverMember.displayName || 'Offline Member');
          const pDate = new Date(p.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });

          // Badge
          doc.rect(46, pY + 4, 75, 12).fill(statusBg);
          doc.fontSize(7).font('Helvetica-Bold').fillColor(statusTextColor).text(statusLabel, 46, pY + 6, {
            width: 75,
            align: 'center',
          });

          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(
            `${payerName} -> ${receiverName} (${p.paymentMethod})`,
            128,
            pY + 5,
            { width: 280, ellipsis: true }
          );
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(
            formatINR(p.amountPaise),
            410,
            pY + 5,
            { width: 140, align: 'right' }
          );

          let subtitle = `Recorded on ${pDate}`;
          if (p.status === 'CANCELLED') {
            subtitle += ' — Cancelled by user. Did not alter net balances.';
          } else if (p.status === 'DISPUTED' && p.disputeReason) {
            subtitle += ` — Dispute reason: "${sanitizeText(p.disputeReason)}"`;
          } else if (p.status === 'CONFIRMED' && p.confirmedAt) {
            subtitle += ` — Confirmed on ${new Date(p.confirmedAt).toLocaleDateString('en-IN')}`;
          }

          doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(
            subtitle,
            46,
            pY + 18,
            { width: 504, ellipsis: true }
          );

          doc.y = pY + 32;
          pIdx++;
        }
      }
      doc.moveDown(0.5);

      // ----------------------------------------------------
      // SECTION 7: DISCOUNTS & ADJUSTMENTS LEDGER
      // ----------------------------------------------------
      drawSectionTitle(`6. Discounts & Residual Debt Waivers (${trip.discounts.length} Records)`);

      if (trip.discounts.length === 0) {
        ensureSpace(20);
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748B').text(
          'No settlement discounts or debt waivers recorded for this trip.'
        );
      } else {
        let dIdx = 0;
        for (const d of trip.discounts) {
          ensureSpace(28);
          const dY = doc.y;

          const fromName = sanitizeText(d.fromMember.user?.name || d.fromMember.displayName || 'Offline Member');
          const toName = sanitizeText(d.toMember.user?.name || d.toMember.displayName || 'Offline Member');
          const dDate = new Date(d.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });

          doc.rect(40, dY, contentWidth, 26).fill(dIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
          doc.moveTo(40, dY + 26).lineTo(40 + contentWidth, dY + 26).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

          // Badge
          const dStatusColor = d.status === 'ACCEPTED' ? '#15803D' : '#64748B';
          const dStatusBg = d.status === 'ACCEPTED' ? '#DCFCE7' : '#F1F5F9';

          doc.rect(46, dY + 3, 65, 11).fill(dStatusBg);
          doc.fontSize(7).font('Helvetica-Bold').fillColor(dStatusColor).text(`[${d.status}]`, 46, dY + 5, {
            width: 65,
            align: 'center',
          });

          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(
            `${fromName} waived ${formatINR(d.waivedPaise)} for ${toName}`,
            118,
            dY + 4,
            { width: 290, ellipsis: true }
          );
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(
            formatINR(d.waivedPaise),
            410,
            dY + 4,
            { width: 140, align: 'right' }
          );

          doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(
            `Date: ${dDate}  |  Reason: ${sanitizeText(d.reason) || 'Residual settlement balance adjustment'}`,
            46,
            dY + 16,
            { width: 504, ellipsis: true }
          );

          doc.y = dY + 28;
          dIdx++;
        }
      }
      doc.moveDown(0.8);

      // ----------------------------------------------------
      // SECTION 8: NOTES, DISCLAIMERS & AUDIT METADATA
      // ----------------------------------------------------
      ensureSpace(80);
      drawSectionTitle('7. Accounting Principles & Verification Notes');

      doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
      doc.text(
        '1. Exact Integer Paise Accounting: TripCircle calculates all financial obligations in integer paise (1/100 of 1 INR). No floating-point rounding errors exist in this statement.',
        46,
        doc.y,
        { width: 504 }
      );
      doc.moveDown(0.3);
      doc.text(
        '2. Zero-Sum Balance Invariant: The mathematical sum of all members\' net balances strictly equals INR 0.00 at all times.',
        46,
        doc.y,
        { width: 504 }
      );
      doc.moveDown(0.3);
      doc.text(
        '3. Payment Confirmation Rule: Payments affect ledger balances only after explicit confirmation by the recipient. Cancelled and disputed payments do not alter balances.',
        46,
        doc.y,
        { width: 504 }
      );
      doc.moveDown(0.3);
      doc.text(
        '4. Sub-Rupee Settlement Rule: Outstanding residual balances below INR 1.00 are handled via mutual settlement discount waivers upon final reconciliation.',
        46,
        doc.y,
        { width: 504 }
      );

      // ----------------------------------------------------
      // TWO-PASS PAGE NUMBERING (BUFFERPAGES)
      // ----------------------------------------------------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(40, doc.page.height - 35).lineTo(40 + contentWidth, doc.page.height - 35).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
        doc.fontSize(7.5).font('Helvetica').fillColor('#94A3B8').text(
          `Page ${i + 1} of ${range.count}   |   TripCircle Official Statement   |   Trip ID: ${trip.id}`,
          40,
          doc.page.height - 25,
          { align: 'center', width: contentWidth }
        );
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
      { header: 'Total Paid (INR)', key: 'totalPaid', width: 16 },
      { header: 'Expense Share (INR)', key: 'share', width: 18 },
      { header: 'Payments Made (INR)', key: 'paymentsMade', width: 18 },
      { header: 'Payments Received (INR)', key: 'paymentsReceived', width: 20 },
      { header: 'Discounts Received (INR)', key: 'discountsReceived', width: 20 },
      { header: 'Discounts Given (INR)', key: 'discountsGiven', width: 20 },
      { header: 'Net Balance (INR)', key: 'netBalance', width: 18 },
      { header: 'Status', key: 'status', width: 18 },
    ];

    for (const [mId, b] of netBalances.entries()) {
      const m = memberMap.get(mId);
      summarySheet.addRow({
        name: m?.user?.name || m?.displayName || 'Offline Member',
        email: m?.user?.email || m?.email || 'N/A',
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
      { header: 'Amount (INR)', key: 'amount', width: 15 },
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
        payer: e.payerMember.user?.name || e.payerMember.displayName || 'Offline Member',
        method: e.splitMethod,
        location: e.location || 'N/A',
      });
    }

    // Sheet 3: Payments
    const paymentSheet = workbook.addWorksheet('Payments');
    paymentSheet.columns = [
      { header: 'Payer', key: 'payer', width: 20 },
      { header: 'Receiver', key: 'receiver', width: 20 },
      { header: 'Amount (INR)', key: 'amount', width: 15 },
      { header: 'Method', key: 'method', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Dispute Reason', key: 'dispute', width: 30 },
      { header: 'Date', key: 'date', width: 18 },
    ];

    for (const p of trip.payments) {
      paymentSheet.addRow({
        payer: p.payerMember.user?.name || p.payerMember.displayName || 'Offline Member',
        receiver: p.receiverMember.user?.name || p.receiverMember.displayName || 'Offline Member',
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
      { header: 'Recommended Transfer (INR)', key: 'amount', width: 25 },
    ];

    for (const t of settlementTransfers) {
      settlementSheet.addRow({
        from: memberMap.get(t.fromMemberId)?.user?.name || memberMap.get(t.fromMemberId)?.displayName || 'Offline Member',
        to: memberMap.get(t.toMemberId)?.user?.name || memberMap.get(t.toMemberId)?.displayName || 'Offline Member',
        amount: (t.amountPaise / 100).toFixed(2),
      });
    }

    // Sheet 5: Discounts & Waivers
    const discountSheet = workbook.addWorksheet('Discounts & Waivers');
    discountSheet.columns = [
      { header: 'From (Creditor / Waived By)', key: 'from', width: 25 },
      { header: 'To (Debtor / Beneficiary)', key: 'to', width: 25 },
      { header: 'Original Debt (INR)', key: 'originalDebt', width: 18 },
      { header: 'Paid Amount (INR)', key: 'paidAmount', width: 18 },
      { header: 'Waived Amount (INR)', key: 'waivedAmount', width: 18 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Reason', key: 'reason', width: 35 },
      { header: 'Date', key: 'date', width: 20 },
    ];

    for (const d of trip.discounts) {
      discountSheet.addRow({
        from: d.fromMember.user?.name || d.fromMember.displayName || 'Offline Member',
        to: d.toMember.user?.name || d.toMember.displayName || 'Offline Member',
        originalDebt: (d.originalDebtPaise / 100).toFixed(2),
        paidAmount: (d.paidAmountPaise / 100).toFixed(2),
        waivedAmount: (d.waivedPaise / 100).toFixed(2),
        status: d.status,
        reason: d.reason || '',
        date: new Date(d.createdAt).toLocaleString(),
      });
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    const filename = `${trip.name.replace(/\s+/g, '_')}_Report.xlsx`;

    return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename };
  }
}

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
          where: { isDeleted: false },
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

      const scopeLabel = input.reportType === 'INDIVIDUAL' ? 'Individual Statement' : 'Full Trip Ledger';

      const resetCursor = () => {
        doc.x = 40;
      };

      const ensureSpace = (neededHeight: number, onNewPage?: () => void) => {
        if (doc.y + neededHeight > doc.page.height - 50) {
          doc.addPage();
          resetCursor();
          doc.y = 48;

          // Render running top header on page 2+
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#0D9488').text('TRIPCIRCLE', 40, 22, { continued: true });
          doc.font('Helvetica').fillColor('#64748B').text(`   |   ${sanitizeText(trip.name)}   |   ${scopeLabel}`);
          doc.moveTo(40, 34).lineTo(40 + contentWidth, 34).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
          resetCursor();
          doc.y = 46;

          if (onNewPage) {
            onNewPage();
          }
        }
      };

      const drawSectionTitle = (title: string, minContentHeight = 60, onNewPage?: () => void) => {
        ensureSpace(38 + minContentHeight, onNewPage);
        doc.moveDown(0.6);
        resetCursor();
        const curY = doc.y;

        // Brand accent pillar
        doc.rect(40, curY, 3, 14).fill('#0D9488');
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A').text(title, 48, curY + 1, {
          width: contentWidth - 8,
          align: 'left',
        });

        const lineY = doc.y + 4;
        doc.moveTo(40, lineY).lineTo(40 + contentWidth, lineY).strokeColor('#E2E8F0').lineWidth(0.75).stroke();
        doc.y = lineY + 6;
        resetCursor();
      };

      const drawBadge = (
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        bgColor: string,
        textColor: string,
        fontSize = 7.5
      ) => {
        doc.roundedRect(x, y, width, height, 3).fill(bgColor);
        doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(textColor).text(text, x, y + (height - fontSize) / 2 - 0.5, {
          width,
          align: 'center',
        });
        resetCursor();
      };

      // ----------------------------------------------------
      // SECTION 1: HEADER & TRIP METADATA
      // ----------------------------------------------------
      doc.rect(40, 40, contentWidth, 4).fill('#0D9488');
      doc.y = 50;
      resetCursor();

      // Top Brand Row
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#0F172A').text('TRIPCIRCLE', 40, 50, { continued: true });
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748B').text('   Financial Statement & Audit Report');

      // Top Right Scope Pill
      drawBadge(
        input.reportType === 'INDIVIDUAL' ? 'INDIVIDUAL STATEMENT' : 'COMPLETE TRIP LEDGER',
        40 + contentWidth - 130,
        48,
        130,
        16,
        '#CCFBF1',
        '#0F766E',
        7.5
      );

      // Trip Metadata Card
      const metaCardY = 74;
      doc.roundedRect(40, metaCardY, contentWidth, 46, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
      const colW = (contentWidth - 16) / 4;

      // Col 1: Trip & Destination
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('TRIP & DESTINATION', 48, metaCardY + 8, { width: colW - 6 });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(sanitizeText(trip.name), 48, metaCardY + 18, {
        width: colW - 6,
        height: 10,
        ellipsis: true,
      });
      doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(sanitizeText(trip.destination || 'N/A'), 48, metaCardY + 30, {
        width: colW - 6,
        height: 9,
        ellipsis: true,
      });

      // Col 2: Dates & Status
      const dateRangeStr = trip.startDate
        ? `${new Date(trip.startDate).toLocaleDateString('en-IN')}${trip.endDate ? ` to ${new Date(trip.endDate).toLocaleDateString('en-IN')}` : ''}`
        : 'Ongoing';
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('DATES & STATUS', 48 + colW, metaCardY + 8, { width: colW });
      doc.fontSize(8).font('Helvetica').fillColor('#0F172A').text(dateRangeStr, 48 + colW, metaCardY + 18, {
        width: colW,
        ellipsis: true,
        lineBreak: false,
      });
      drawBadge(trip.status, 48 + colW, metaCardY + 29, 48, 11, trip.status === 'ACTIVE' ? '#DCFCE7' : '#F1F5F9', trip.status === 'ACTIVE' ? '#15803D' : '#64748B', 6.5);

      // Col 3: Currency & Accounting
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('CURRENCY & UNIT', 48 + colW * 2, metaCardY + 8, { width: colW });
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(`${trip.currency || 'INR'} (Indian Rupee)`, 48 + colW * 2, metaCardY + 18, {
        width: colW,
        lineBreak: false,
      });
      doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text('Integer Paise Precision', 48 + colW * 2, metaCardY + 29, {
        width: colW,
        lineBreak: false,
      });

      // Col 4: Audit & Timestamp
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('STATEMENT GENERATED', 48 + colW * 3, metaCardY + 8, { width: colW });
      doc.fontSize(7.5).font('Helvetica').fillColor('#0F172A').text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 48 + colW * 3, metaCardY + 18, {
        width: colW,
        lineBreak: false,
      });
      doc.fontSize(6.5).font('Helvetica').fillColor('#94A3B8').text(`ID: ${trip.id.slice(0, 16)}...`, 48 + colW * 3, metaCardY + 29, {
        width: colW,
        lineBreak: false,
      });

      doc.y = metaCardY + 54;
      resetCursor();

      // ----------------------------------------------------
      // SECTION 2: GROUP FINANCIAL OVERVIEW (STAT CARDS)
      // ----------------------------------------------------
      const totalExpensePaise = trip.expenses.reduce((sum: number, e: any) => sum + e.amountPaise, 0);
      const confirmedPayments = trip.payments.filter((p: any) => p.status === 'CONFIRMED');
      const totalConfirmedPaymentPaise = confirmedPayments.reduce((sum: number, p: any) => sum + p.amountPaise, 0);
      const acceptedDiscounts = trip.discounts.filter((d: any) => d.status === 'ACCEPTED');
      const totalDiscountPaise = acceptedDiscounts.reduce((sum: number, d: any) => sum + d.waivedPaise, 0);

      drawSectionTitle('1. Group Financial Overview', 55);

      const overviewCardY = doc.y;
      const statCardGutter = 8;
      const statCardW = (contentWidth - statCardGutter * 3) / 4;
      const statCardH = 46;

      // Stat Card 1: Total Spend
      doc.roundedRect(40, overviewCardY, statCardW, statCardH, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('TOTAL GROUP SPEND', 46, overviewCardY + 8, { width: statCardW - 12 });
      doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0F172A').text(formatINR(totalExpensePaise), 46, overviewCardY + 22, { width: statCardW - 12 });

      // Stat Card 2: Settlements Paid
      const c2X = 40 + statCardW + statCardGutter;
      doc.roundedRect(c2X, overviewCardY, statCardW, statCardH, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('SETTLEMENTS PAID', c2X + 6, overviewCardY + 8, { width: statCardW - 12 });
      doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0F172A').text(formatINR(totalConfirmedPaymentPaise), c2X + 6, overviewCardY + 22, { width: statCardW - 12 });

      // Stat Card 3: Waived Discounts
      const c3X = c2X + statCardW + statCardGutter;
      doc.roundedRect(c3X, overviewCardY, statCardW, statCardH, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('WAIVED DISCOUNTS', c3X + 6, overviewCardY + 8, { width: statCardW - 12 });
      doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0F172A').text(formatINR(totalDiscountPaise), c3X + 6, overviewCardY + 22, { width: statCardW - 12 });

      // Stat Card 4: Settlement Health
      const c4X = c3X + statCardW + statCardGutter;
      doc.roundedRect(c4X, overviewCardY, statCardW, statCardH, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748B').text('SETTLEMENT HEALTH', c4X + 6, overviewCardY + 8, { width: statCardW - 12 });
      const isAllSettled = settlementTransfers.length === 0;
      drawBadge(
        isAllSettled ? 'All Settled' : `${settlementTransfers.length} Pending Transfers`,
        c4X + 6,
        overviewCardY + 22,
        statCardW - 12,
        15,
        isAllSettled ? '#DCFCE7' : '#FEF3C7',
        isAllSettled ? '#15803D' : '#B45309',
        7.5
      );

      doc.y = overviewCardY + statCardH + 8;
      resetCursor();

      // ----------------------------------------------------
      // SECTION 3: BALANCES & MEMBER STATEMENTS
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

        drawSectionTitle(`2. Individual Member Statement: ${targetMemberName}`, 115);

        const net = state.netBalancePaise;
        const netStr = formatINR(Math.abs(net));
        const netColor = net > 0 ? '#15803D' : net < 0 ? '#B91C1C' : '#475569';
        const netBg = net > 0 ? '#DCFCE7' : net < 0 ? '#FEE2E2' : '#F1F5F9';
        const netStatus = net > 0 ? `YOU ARE OWED ${netStr}` : net < 0 ? `YOU OWE ${netStr}` : 'FULLY SETTLED (INR 0.00)';

        ensureSpace(115);
        const cardY = doc.y;
        doc.roundedRect(40, cardY, contentWidth, 108, 4).fillAndStroke('#F8FAFC', '#CBD5E1');

        // Member Header
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0F172A').text(`Account: ${targetMemberName} (${targetMemberEmail})`, 50, cardY + 8);

        // Prominent Net Hero Badge
        drawBadge(`Net Financial Position: ${netStatus}`, 50, cardY + 22, contentWidth - 20, 18, netBg, netColor, 9);

        // 2-Column Ledger Position Breakdown
        const midX = 40 + contentWidth / 2;
        doc.fontSize(8.5).font('Helvetica').fillColor('#334155');

        // Left Column (Credits / Outgoing Funds)
        doc.text(`Total Paid for Expenses: ${formatINR(state.totalPaidPaise)}`, 52, cardY + 46);
        doc.text(`Confirmed Payments Made: ${formatINR(state.paymentsMadePaise)}`, 52, cardY + 60);
        doc.text(`Discounts Given (Waived): ${formatINR(state.discountsGivenPaise)}`, 52, cardY + 74);

        // Right Column (Debits / Consumed Shares)
        doc.text(`Total Expense Share (Debits): ${formatINR(state.totalExpenseSharePaise)}`, midX + 6, cardY + 46);
        doc.text(`Confirmed Payments Received: ${formatINR(state.paymentsReceivedPaise)}`, midX + 6, cardY + 60);
        doc.text(`Discounts Received: ${formatINR(state.discountsReceivedPaise)}`, midX + 6, cardY + 74);

        // Explanatory footer line
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#64748B').text(
          'Exact net position = (Paid + Payments Made + Discounts Given) - (Expense Share + Payments Received + Discounts Received)',
          52,
          cardY + 92,
          { width: contentWidth - 24 }
        );

        doc.y = cardY + 116;
        resetCursor();
      } else {
        // Table layout with guaranteed repetition across page boundaries
        const renderBalancesTableHeader = () => {
          const thY = doc.y;
          doc.rect(40, thY, contentWidth, 20).fill('#0F766E');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('MEMBER', 46, thY + 6, { width: 135 });
          doc.text('PAID', 181, thY + 6, { width: 68, align: 'right' });
          doc.text('SHARE', 249, thY + 6, { width: 68, align: 'right' });
          doc.text('PAYMENTS', 317, thY + 6, { width: 75, align: 'right' });
          doc.text('DISCOUNTS', 392, thY + 6, { width: 68, align: 'right' });
          doc.text('NET BALANCE', 460, thY + 6, { width: 90, align: 'right' });
          doc.y = thY + 20;
          resetCursor();
        };

        drawSectionTitle('2. Member-wise Net Balances', 45, renderBalancesTableHeader);
        renderBalancesTableHeader();

        let rowIndex = 0;
        let sumPaid = 0;
        let sumShare = 0;
        let sumPayments = 0;
        let sumDiscounts = 0;

        for (const [mId, b] of netBalances.entries()) {
          ensureSpace(20, renderBalancesTableHeader);
          const m = memberMap.get(mId);
          const mName = sanitizeText(m?.user?.name || m?.displayName || 'Offline Member');
          const rowY = doc.y;

          doc.rect(40, rowY, contentWidth, 19).fill(rowIndex % 2 === 1 ? '#F8FAFC' : '#FFFFFF');
          doc.moveTo(40, rowY + 19).lineTo(40 + contentWidth, rowY + 19).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

          const net = b.netBalancePaise;
          const netColor = net > 0 ? '#059669' : net < 0 ? '#DC2626' : '#475569';
          const netLabel = net > 0 ? `+${formatINR(net)}` : net < 0 ? formatINR(net) : 'INR 0.00';
          const netPayments = b.paymentsMadePaise - b.paymentsReceivedPaise;
          const netDiscounts = b.discountsGivenPaise - b.discountsReceivedPaise;

          sumPaid += b.totalPaidPaise;
          sumShare += b.totalExpenseSharePaise;
          sumPayments += netPayments;
          sumDiscounts += netDiscounts;

          doc.fontSize(8).font('Helvetica').fillColor('#0F172A').text(mName, 46, rowY + 5, { width: 135, ellipsis: true });
          doc.text(formatINR(b.totalPaidPaise), 181, rowY + 5, { width: 68, align: 'right' });
          doc.text(formatINR(b.totalExpenseSharePaise), 249, rowY + 5, { width: 68, align: 'right' });
          doc.text(formatINR(netPayments), 317, rowY + 5, { width: 75, align: 'right' });
          doc.text(formatINR(netDiscounts), 392, rowY + 5, { width: 68, align: 'right' });
          doc.font('Helvetica-Bold').fillColor(netColor).text(netLabel, 460, rowY + 5, { width: 90, align: 'right' });

          doc.y = rowY + 19;
          resetCursor();
          rowIndex++;
        }

        // Summary reconciliation footer row
        ensureSpace(22, renderBalancesTableHeader);
        const sumY = doc.y;
        doc.rect(40, sumY, contentWidth, 20).fill('#F1F5F9');
        doc.moveTo(40, sumY).lineTo(40 + contentWidth, sumY).strokeColor('#CBD5E1').lineWidth(1).stroke();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A').text('TOTAL RECONCILIATION', 46, sumY + 6, { width: 135 });
        doc.text(formatINR(sumPaid), 181, sumY + 6, { width: 68, align: 'right' });
        doc.text(formatINR(sumShare), 249, sumY + 6, { width: 68, align: 'right' });
        doc.text(formatINR(sumPayments), 317, sumY + 6, { width: 75, align: 'right' });
        doc.text(formatINR(sumDiscounts), 392, sumY + 6, { width: 68, align: 'right' });
        doc.fillColor('#0F172A').text('INR 0.00', 460, sumY + 6, { width: 90, align: 'right' });

        doc.y = sumY + 24;
        resetCursor();
      }

      // ----------------------------------------------------
      // SECTION 4: RECOMMENDED SETTLEMENT TRANSFERS
      // ----------------------------------------------------
      drawSectionTitle('3. Recommended Settlement Transfers (Simplified Greedy Routing)', 35);

      if (settlementTransfers.length === 0) {
        ensureSpace(28);
        const okY = doc.y;
        doc.roundedRect(40, okY, contentWidth, 24, 4).fillAndStroke('#ECFDF5', '#A7F3D0');
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#065F46').text(
          'All member balances are fully settled! No cash or UPI transfers required.',
          50,
          okY + 7,
          { width: contentWidth - 20 }
        );
        doc.y = okY + 30;
        resetCursor();
      } else {
        let tIdx = 1;
        for (const t of settlementTransfers) {
          ensureSpace(26);
          const fromName = sanitizeText(memberMap.get(t.fromMemberId)?.user?.name || memberMap.get(t.fromMemberId)?.displayName || 'Offline Member');
          const toName = sanitizeText(memberMap.get(t.toMemberId)?.user?.name || memberMap.get(t.toMemberId)?.displayName || 'Offline Member');
          const transferY = doc.y;

          doc.roundedRect(40, transferY, contentWidth, 22, 3).fillAndStroke('#FFFBEB', '#FDE68A');

          // Step Pill
          drawBadge(`Step ${tIdx}`, 46, transferY + 4, 38, 14, '#FEF3C7', '#92400E', 7);

          // Flow Text
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#92400E').text(
            `Transfer: ${fromName} -> pays -> ${toName} : ${formatINR(t.amountPaise)}`,
            90,
            transferY + 6,
            { width: 330, ellipsis: true }
          );

          // Amount Badge
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#92400E').text(
            formatINR(t.amountPaise),
            420,
            transferY + 6,
            { width: 130, align: 'right' }
          );

          doc.y = transferY + 26;
          resetCursor();
          tIdx++;
        }
      }

      // ----------------------------------------------------
      // SECTION 5: DETAILED EXPENSE LEDGER
      // ----------------------------------------------------
      drawSectionTitle(`4. Detailed Expense Ledger (${trip.expenses.length} Records)`, 45);

      if (trip.expenses.length === 0) {
        ensureSpace(22);
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748B').text('No expenses recorded for this trip.');
        doc.moveDown(0.5);
        resetCursor();
      } else {
        let eIdx = 0;
        for (const e of trip.expenses) {
          const dateStr = new Date(e.expenseDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const payerName = sanitizeText(e.payerMember.user?.name || e.payerMember.displayName || 'Offline Member');
          const desc = sanitizeText(e.description);
          const cat = sanitizeText(e.category?.name || 'General');

          // Member allocations string
          const sharesList = e.allocations
            .map((a: any) => `${sanitizeText(a.member.user?.name || a.member.displayName || 'Member')}: ${formatINR(a.sharePaise)}`)
            .join('   |   ');

          doc.fontSize(7.5).font('Helvetica');
          const allocationsHeight = doc.heightOfString(`Shares: ${sharesList}`, {
            width: contentWidth - 16,
          });

          const totalRowHeight = Math.max(34, 22 + allocationsHeight + 6);
          ensureSpace(totalRowHeight + 4);

          const eY = doc.y;
          const isEven = eIdx % 2 === 0;

          doc.roundedRect(40, eY, contentWidth, totalRowHeight, 3).fill(isEven ? '#FFFFFF' : '#F8FAFC');
          doc.moveTo(40, eY + totalRowHeight).lineTo(40 + contentWidth, eY + totalRowHeight).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

          // Line 1: Date | Description (Category) ... Amount
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(
            `${dateStr} — ${desc} (${cat})`,
            48,
            eY + 5,
            { width: 360, ellipsis: true }
          );
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(
            formatINR(e.amountPaise),
            410,
            eY + 5,
            { width: 140, align: 'right' }
          );

          // Line 2: Paid by info
          doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(
            `Paid by: ${payerName} [${e.splitMethod}]`,
            48,
            eY + 18,
            { width: 360, ellipsis: true }
          );

          // Line 3: Multi-line wrapped shares allocations
          doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(
            `Shares: ${sharesList}`,
            48,
            eY + 28,
            { width: contentWidth - 16 }
          );

          doc.y = eY + totalRowHeight + 3;
          resetCursor();
          eIdx++;
        }
      }

      // ----------------------------------------------------
      // SECTION 6: PAYMENTS & CONFIRMATIONS LEDGER
      // ----------------------------------------------------
      drawSectionTitle(`5. Payments & Confirmations Ledger (${trip.payments.length} Records)`, 40);

      if (trip.payments.length === 0) {
        ensureSpace(22);
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748B').text('No settlement payments recorded.');
        doc.moveDown(0.5);
        resetCursor();
      } else {
        let pIdx = 0;
        for (const p of trip.payments) {
          ensureSpace(34);
          const pY = doc.y;

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

          doc.roundedRect(40, pY, contentWidth, 30, 3).fill(pIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
          doc.moveTo(40, pY + 30).lineTo(40 + contentWidth, pY + 30).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

          const payerName = sanitizeText(p.payerMember.user?.name || p.payerMember.displayName || 'Offline Member');
          const receiverName = sanitizeText(p.receiverMember.user?.name || p.receiverMember.displayName || 'Offline Member');
          const pDate = new Date(p.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });

          // Badge
          drawBadge(statusLabel, 46, pY + 4, 75, 12, statusBg, statusTextColor, 7);

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

          doc.y = pY + 33;
          resetCursor();
          pIdx++;
        }
      }

      // ----------------------------------------------------
      // SECTION 7: DISCOUNTS & ADJUSTMENTS LEDGER
      // ----------------------------------------------------
      drawSectionTitle(`6. Discounts & Residual Debt Waivers (${trip.discounts.length} Records)`, 35);

      if (trip.discounts.length === 0) {
        ensureSpace(22);
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748B').text(
          'No settlement discounts or debt waivers recorded for this trip.'
        );
        doc.moveDown(0.5);
        resetCursor();
      } else {
        let dIdx = 0;
        for (const d of trip.discounts) {
          ensureSpace(30);
          const dY = doc.y;

          const fromName = sanitizeText(d.fromMember.user?.name || d.fromMember.displayName || 'Offline Member');
          const toName = sanitizeText(d.toMember.user?.name || d.toMember.displayName || 'Offline Member');
          const dDate = new Date(d.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });

          doc.roundedRect(40, dY, contentWidth, 26, 3).fill(dIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
          doc.moveTo(40, dY + 26).lineTo(40 + contentWidth, dY + 26).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

          const dStatusColor = d.status === 'ACCEPTED' ? '#15803D' : '#64748B';
          const dStatusBg = d.status === 'ACCEPTED' ? '#DCFCE7' : '#F1F5F9';

          drawBadge(`[${d.status}]`, 46, dY + 3, 65, 12, dStatusBg, dStatusColor, 7);

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

          doc.y = dY + 29;
          resetCursor();
          dIdx++;
        }
      }

      // ----------------------------------------------------
      // SECTION 8: NOTES, DISCLAIMERS & AUDIT METADATA
      // ----------------------------------------------------
      const note1 = '1. Exact Integer Paise Accounting: TripCircle calculates all financial obligations in integer paise (1/100 of 1 INR). No floating-point rounding errors exist in this statement.';
      const note2 = '2. Zero-Sum Balance Invariant: The mathematical sum of all members\' net balances strictly equals INR 0.00 at all times.';
      const note3 = '3. Payment Confirmation Rule: Payments affect ledger balances only after explicit confirmation by the recipient. Cancelled and disputed payments do not alter balances.';
      const note4 = '4. Sub-Rupee Settlement Rule: Outstanding residual balances below INR 1.00 are handled via mutual settlement discount waivers upon final reconciliation.';

      doc.fontSize(7.5).font('Helvetica');
      const noteBoxW = contentWidth - 16;
      const noteBoxH =
        doc.heightOfString(note1, { width: noteBoxW }) +
        doc.heightOfString(note2, { width: noteBoxW }) +
        doc.heightOfString(note3, { width: noteBoxW }) +
        doc.heightOfString(note4, { width: noteBoxW }) +
        32;

      ensureSpace(noteBoxH + 45);
      drawSectionTitle('7. Accounting Principles & Verification Notes', noteBoxH);

      const noteBoxY = doc.y;
      doc.roundedRect(40, noteBoxY, contentWidth, noteBoxH, 4).fillAndStroke('#F8FAFC', '#E2E8F0');

      doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
      doc.y = noteBoxY + 7;

      doc.text(note1, 48, doc.y, { width: noteBoxW });
      doc.moveDown(0.3);
      doc.text(note2, 48, doc.y, { width: noteBoxW });
      doc.moveDown(0.3);
      doc.text(note3, 48, doc.y, { width: noteBoxW });
      doc.moveDown(0.3);
      doc.text(note4, 48, doc.y, { width: noteBoxW });

      doc.y = noteBoxY + noteBoxH + 8;
      resetCursor();

      // ----------------------------------------------------
      // TWO-PASS PAGE NUMBERING & FOOTERS (ZERO GHOST PAGES)
      // ----------------------------------------------------
      // Temporarily disable bottom margin to prevent PDFKit from triggering auto-page-breaks
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);
        // Suppress automatic page addition when writing the footer near page bottom
        doc.page.margins.bottom = 0;

        const footerY = doc.page.height - 30;
        doc.moveTo(40, footerY - 5).lineTo(40 + contentWidth, footerY - 5).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

        doc.fontSize(7).font('Helvetica').fillColor('#94A3B8').text(
          `TripCircle Official Statement   |   Trip ID: ${trip.id}   |   Confidential & Audit-Verified`,
          40,
          footerY,
          { width: contentWidth - 80, lineBreak: false }
        );

        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748B').text(
          `Page ${i + 1} of ${totalPages}`,
          40,
          footerY,
          { width: contentWidth, align: 'right', lineBreak: false }
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

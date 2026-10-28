import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { ExportReportSchema } from '@tripcircle/contracts';
import { ReportService } from '@/modules/reports/service';
import { handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = ExportReportSchema.parse(body);

    const { buffer, contentType, filename } = await ReportService.generateReport(
      params.id,
      authUser.id,
      validated
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const { searchParams } = new URL(req.url);

    const reportType = (searchParams.get('reportType') || 'TRIP_LEDGER') as 'INDIVIDUAL' | 'TRIP_LEDGER';
    const format = (searchParams.get('format') || 'PDF') as 'PDF' | 'XLSX';
    const memberId = searchParams.get('memberId') || undefined;

    const validated = ExportReportSchema.parse({
      reportType,
      format,
      memberId,
      includeReceipts: searchParams.get('includeReceipts') === 'true',
    });

    const { buffer, contentType, filename } = await ReportService.generateReport(
      params.id,
      authUser.id,
      validated
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

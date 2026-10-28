import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { LedgerService } from '@/modules/ledger/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const ledger = await LedgerService.getTripLedger(params.id, authUser.id);
    return successResponse(ledger);
  } catch (err) {
    return handleApiError(err);
  }
}

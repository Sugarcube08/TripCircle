import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { SettlementService } from '@/modules/settlements/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const plan = await SettlementService.getSettlementPlan(params.id, authUser.id);
    return successResponse(plan);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { ProposeDiscountSchema } from '@tripcircle/contracts';
import { SettlementService } from '@/modules/settlements/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = ProposeDiscountSchema.parse(body);
    const discount = await SettlementService.proposeDiscount(params.id, authUser.id, validated);
    return successResponse(discount, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { RespondDiscountSchema } from '@tripcircle/contracts';
import { SettlementService } from '@/modules/settlements/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; discountId: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = RespondDiscountSchema.parse(body);
    const result = await SettlementService.respondDiscount(
      params.id,
      params.discountId,
      authUser.id,
      validated
    );
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

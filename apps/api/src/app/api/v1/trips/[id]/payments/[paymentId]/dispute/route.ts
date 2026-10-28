import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { DisputePaymentSchema } from '@tripcircle/contracts';
import { PaymentService } from '@/modules/payments/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; paymentId: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = DisputePaymentSchema.parse(body);
    const disputed = await PaymentService.disputePayment(
      params.id,
      params.paymentId,
      authUser.id,
      validated
    );
    return successResponse(disputed);
  } catch (err) {
    return handleApiError(err);
  }
}

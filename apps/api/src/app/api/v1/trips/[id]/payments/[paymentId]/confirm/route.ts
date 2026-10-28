import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { ConfirmPaymentSchema } from '@tripcircle/contracts';
import { PaymentService } from '@/modules/payments/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; paymentId: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json().catch(() => ({}));
    const validated = ConfirmPaymentSchema.parse(body);
    const confirmed = await PaymentService.confirmPayment(
      params.id,
      params.paymentId,
      authUser.id,
      validated
    );
    return successResponse(confirmed);
  } catch (err) {
    return handleApiError(err);
  }
}

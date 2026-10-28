import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { PaymentService } from '@/modules/payments/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; paymentId: string } }
) {
  try {
    await getAuthUser(req);
    const payment = await PaymentService.getPaymentDetail(params.id, params.paymentId);
    return successResponse(payment);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; paymentId: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const cancelled = await PaymentService.cancelPayment(params.id, params.paymentId, authUser.id);
    return successResponse(cancelled);
  } catch (err) {
    return handleApiError(err);
  }
}

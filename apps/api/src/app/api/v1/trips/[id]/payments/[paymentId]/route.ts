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
    const authUser = await getAuthUser(req);
    const payment = await PaymentService.getPaymentDetail(params.id, params.paymentId, authUser.id);
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
    const deleted = await PaymentService.deletePayment(params.id, params.paymentId, authUser.id);
    return successResponse(deleted);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; paymentId: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const { z } = await import('zod');
    const schema = z.object({
      amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      paymentMethod: z.enum(['UPI', 'CASH', 'OTHER']),
      note: z.string().max(2000).nullable().optional(),
      receiptUrl: z.string().url().nullable().optional(),
    });
    const input = schema.parse(body);
    const updated = await PaymentService.updatePendingPayment(
      params.id,
      params.paymentId,
      authUser.id,
      input
    );
    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

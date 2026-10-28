import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { CreatePaymentSchema } from '@tripcircle/contracts';
import { PaymentService } from '@/modules/payments/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getAuthUser(req);
    const payments = await PaymentService.listPayments(params.id);
    return successResponse(payments);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = CreatePaymentSchema.parse(body);
    const payment = await PaymentService.createPayment(params.id, authUser.id, validated);
    return successResponse(payment, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

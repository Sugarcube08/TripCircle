import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { PaymentService } from '@/modules/payments/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  try { const authUser = await getAuthUser(req); return successResponse(await PaymentService.deletePayment(params.id, params.paymentId, authUser.id)); }
  catch (err) { return handleApiError(err); }
}

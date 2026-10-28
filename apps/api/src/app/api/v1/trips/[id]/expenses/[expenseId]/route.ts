import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { EditExpenseSchema } from '@tripcircle/contracts';
import { ExpenseService } from '@/modules/expenses/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; expenseId: string } }
) {
  try {
    await getAuthUser(req);
    const expense = await ExpenseService.getExpenseDetail(params.id, params.expenseId);
    return successResponse(expense);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; expenseId: string } }
) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = EditExpenseSchema.parse(body);
    const updated = await ExpenseService.editExpense(
      params.id,
      params.expenseId,
      authUser.id,
      validated
    );
    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

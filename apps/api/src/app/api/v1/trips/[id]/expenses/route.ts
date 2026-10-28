import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { CreateExpenseSchema } from '@tripcircle/contracts';
import { ExpenseService } from '@/modules/expenses/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const expenses = await ExpenseService.listExpenses(params.id);
    return successResponse(expenses);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = CreateExpenseSchema.parse(body);
    const expense = await ExpenseService.createExpense(params.id, authUser.id, validated);
    return successResponse(expense, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from 'next/server';
import { ResetPasswordSchema } from '@tripcircle/contracts';
import { AuthService } from '@/modules/auth/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = ResetPasswordSchema.parse(body);
    const result = await AuthService.resetPassword(validated);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

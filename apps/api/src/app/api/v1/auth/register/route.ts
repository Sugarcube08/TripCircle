import { NextRequest } from 'next/server';
import { RegisterSchema } from '@tripcircle/contracts';
import { AuthService } from '@/modules/auth/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = RegisterSchema.parse(body);
    const result = await AuthService.register(validated);
    return successResponse(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from 'next/server';
import { AuthService } from '@/modules/auth/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.refreshToken) {
      throw new Error('Refresh token is required');
    }
    const result = await AuthService.refresh(body.refreshToken);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

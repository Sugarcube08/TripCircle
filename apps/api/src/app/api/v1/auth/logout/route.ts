import { NextRequest } from 'next/server';
import { AuthService } from '@/modules/auth/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.refreshToken) {
      await AuthService.logout(body.refreshToken);
    }
    return successResponse({ message: 'Logged out successfully' });
  } catch (err) {
    return handleApiError(err);
  }
}

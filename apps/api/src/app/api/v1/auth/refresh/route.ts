import { NextRequest } from 'next/server';
import { AuthService } from '@/modules/auth/service';
import { successResponse, handleApiError } from '@/lib/api-response';
import { RefreshTokenSchema } from '@tripcircle/contracts';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const validated = RefreshTokenSchema.parse(rawBody);

    const userAgent = req.headers.get('user-agent') || undefined;
    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      undefined;

    const result = await AuthService.refresh(validated.refreshToken, userAgent, ipAddress);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

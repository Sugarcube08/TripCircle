import { NextRequest } from 'next/server';
import { LoginSchema } from '@tripcircle/contracts';
import { AuthService } from '@/modules/auth/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = LoginSchema.parse(body);
    const userAgent = req.headers.get('user-agent') || undefined;
    const ipAddress = req.headers.get('x-forwarded-for') || undefined;

    const result = await AuthService.login(validated, userAgent, ipAddress);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

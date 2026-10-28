import { NextRequest } from 'next/server';
import { ResendOtpSchema } from '@tripcircle/contracts';
import { AuthService } from '@/modules/auth/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = ResendOtpSchema.parse(body);
    const result = await AuthService.resendOtp(validated.email, validated.purpose);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

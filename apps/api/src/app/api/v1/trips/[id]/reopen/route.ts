import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { TripService } from '@/modules/trips/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const trip = await TripService.reopenTrip(params.id, authUser.id);
    return successResponse(trip);
  } catch (err) {
    return handleApiError(err);
  }
}

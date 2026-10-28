import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { CreateTripSchema } from '@tripcircle/contracts';
import { TripService } from '@/modules/trips/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const result = await TripService.getMyTrips(authUser.id);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = CreateTripSchema.parse(body);
    const trip = await TripService.createTrip(authUser.id, validated);
    return successResponse(trip, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

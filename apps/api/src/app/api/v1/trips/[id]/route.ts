import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { UpdateTripSchema } from '@tripcircle/contracts';
import { TripService } from '@/modules/trips/service';
import { successResponse, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const trip = await TripService.getTripDetail(params.id, authUser.id);
    return successResponse(trip);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const validated = UpdateTripSchema.parse(body);
    const updated = await TripService.updateTrip(params.id, authUser.id, validated);
    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

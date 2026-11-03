import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { AuthService } from '../../src/modules/auth/service';
import { TripService } from '../../src/modules/trips/service';

describe('Permanent trip deletion', () => {
  let userId: string | null = null;
  let tripId: string | null = null;

  beforeAll(async () => {
    const suffix = Date.now();
    const user = await AuthService.register({
      name: 'Trip Deletion Creator',
      email: `trip_delete_${suffix}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/trip-delete-qr.png',
    });
    userId = user.userId;
    const trip = await TripService.createTrip(userId!, {
      name: 'Trip To Delete',
      currency: 'INR',
      startDate: new Date().toISOString(),
      initialDummyMembers: [{ name: 'Offline Companion' }],
    });
    tripId = trip.id;
  });

  afterAll(async () => {
    if (tripId) await prisma.trip.deleteMany({ where: { id: tripId! } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('permanently deletes a creator-owned trip and cascaded members', async () => {
    const result = await TripService.deleteTrip(tripId!, userId!);
    expect(result).toEqual({ id: tripId, deleted: true });
    expect(await prisma.trip.findUnique({ where: { id: tripId! } })).toBeNull();
    expect(await prisma.tripMember.count({ where: { tripId: tripId! } })).toBe(0);
  });
});

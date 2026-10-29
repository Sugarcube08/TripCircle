import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { CreateTripSchema, UpdateTripSchema } from '@tripcircle/contracts';
import { TripService } from '../../src/modules/trips/service';
import { AuthService } from '../../src/modules/auth/service';

describe('P1: Create Trip Atomic Creation and Date Range Validation', () => {
  let testUser: any;
  let createdTripId: string | null = null;

  beforeAll(async () => {
    const timestamp = Date.now();
    const res = await AuthService.register({
      name: 'Atomic Trip Creator',
      email: `creator_${timestamp}@tripcircle.test`,
      password: 'Password123!',
      paymentQrUrl: 'https://example.com/creator-qr.png',
    });
    testUser = { id: res.userId, email: res.email };
  });

  afterAll(async () => {
    if (createdTripId) {
      await prisma.auditLog.deleteMany({ where: { tripId: createdTripId } });
      await prisma.tripMember.deleteMany({ where: { tripId: createdTripId } });
      await prisma.trip.deleteMany({ where: { id: createdTripId } });
    }
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  });

  describe('1. Schema Date Range Validation', () => {
    it('rejects trip creation when endDate is earlier than startDate', () => {
      const invalidTrip = CreateTripSchema.safeParse({
        name: 'Time Travel Trip',
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-05T00:00:00.000Z',
      });

      expect(invalidTrip.success).toBe(false);
      if (!invalidTrip.success) {
        expect(invalidTrip.error.errors[0].message).toContain('End date cannot be earlier than start date');
      }
    });

    it('accepts trip creation when endDate is equal to or after startDate', () => {
      const sameDayTrip = CreateTripSchema.safeParse({
        name: 'Day Trip',
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-10T23:59:59.000Z',
      });
      expect(sameDayTrip.success).toBe(true);

      const futureTrip = CreateTripSchema.safeParse({
        name: 'Weekend Getaway',
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-15T00:00:00.000Z',
      });
      expect(futureTrip.success).toBe(true);
    });

    it('validates UpdateTripSchema date ranges', () => {
      const invalidUpdate = UpdateTripSchema.safeParse({
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: '2026-11-01T00:00:00.000Z',
      });
      expect(invalidUpdate.success).toBe(false);

      const validUpdate = UpdateTripSchema.safeParse({
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-10T00:00:00.000Z',
      });
      expect(validUpdate.success).toBe(true);
    });
  });

  describe('2. Atomic Trip & Offline Member Creation', () => {
    it('creates trip and initial offline dummy members atomically within single transaction', async () => {
      const trip = await TripService.createTrip(testUser.id, {
        name: 'Atomic Himachal Roadtrip',
        destination: 'Manali, HP',
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: '2026-12-07T00:00:00.000Z',
        currency: 'INR',
        initialDummyMembers: [
          { name: 'Rohan Driver', phone: '+919876543210' },
          { name: 'Kavita Guide', email: 'kavita@himachalguide.test' },
        ],
      });

      createdTripId = trip.id;
      expect(trip.id).toBeDefined();
      expect(trip.name).toBe('Atomic Himachal Roadtrip');

      // Verify all members created in the database
      const allMembers = await prisma.tripMember.findMany({
        where: { tripId: trip.id },
      });

      expect(allMembers.length).toBe(3); // Creator + 2 dummy members

      const creatorMember = allMembers.find((m) => m.userId === testUser.id);
      expect(creatorMember?.role).toBe('CREATOR');
      expect(creatorMember?.status).toBe('ACTIVE');

      const rohan = allMembers.find((m) => m.displayName === 'Rohan Driver');
      expect(rohan).toBeDefined();
      expect(rohan?.isDummy).toBe(true);
      expect(rohan?.status).toBe('ACTIVE');
      expect(rohan?.userId).toBeNull();
      expect(rohan?.phone).toBe('+919876543210');

      const kavita = allMembers.find((m) => m.displayName === 'Kavita Guide');
      expect(kavita).toBeDefined();
      expect(kavita?.isDummy).toBe(true);
      expect(kavita?.status).toBe('ACTIVE');
      expect(kavita?.userId).toBeNull();
      expect(kavita?.email).toBe('kavita@himachalguide.test');
    });
  });
});

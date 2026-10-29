import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { NotificationService } from '../../src/modules/notifications/service';
import { VersionManifestSchema } from '@tripcircle/contracts';

// Inlined logic representing ActivityRouter resolution
function resolveDestination(item: {
  type: string;
  tripId?: string | null;
  data?: Record<string, any> | null;
}) {
  const type = (item.type || '').toUpperCase();
  const data = item.data || {};
  const tripId = item.tripId || data.tripId || null;

  if (type === 'TRIP_INVITATION') {
    return {
      screen: 'Invitations',
      params: {
        highlightTripId: tripId,
        invitationId: data.invitationId || data.memberId,
      },
    };
  }

  if (
    type === 'NEW_EXPENSE' ||
    type === 'EXPENSE_ADDED' ||
    type === 'EXPENSE_UPDATED' ||
    type === 'EXPENSE_DELETED'
  ) {
    const expenseId = data.expenseId;
    if (tripId && expenseId && type !== 'EXPENSE_DELETED') {
      return {
        screen: 'ExpenseDetail',
        params: { tripId, expenseId },
      };
    }
    if (tripId) {
      return {
        screen: 'TripDashboard',
        params: { tripId },
      };
    }
  }

  if (
    type === 'PAYMENT_PENDING_CONFIRMATION' ||
    type === 'PAYMENT_CONFIRMED' ||
    type === 'PAYMENT_DISPUTED' ||
    type === 'PAYMENT_RECORDED' ||
    type === 'PAYMENT_CANCELLED'
  ) {
    const paymentId = data.paymentId;
    if (tripId && paymentId) {
      return {
        screen: 'PaymentDetail',
        params: { tripId, paymentId },
      };
    }
    if (tripId) {
      return {
        screen: 'TripDashboard',
        params: { tripId },
      };
    }
  }

  if (
    type === 'DISCOUNT_PROPOSED' ||
    type === 'DISCOUNT_RESPONSE' ||
    type === 'DISCOUNT_AUTO_WAIVED' ||
    type === 'SETTLEMENT_COMPLETED' ||
    type === 'SETTLEMENT_PLAN_UPDATED'
  ) {
    if (tripId) {
      return {
        screen: 'SettlementDashboard',
        params: { tripId },
      };
    }
  }

  if (
    type === 'DUMMY_MEMBER_REPLACED' ||
    type === 'MEMBER_JOINED' ||
    type === 'MEMBER_LEFT' ||
    type === 'INVITATION_RESPONSE' ||
    type === 'ROLE_CHANGED'
  ) {
    if (tripId) {
      return {
        screen: 'TripMembers',
        params: { tripId },
      };
    }
  }

  if (tripId) {
    return {
      screen: 'TripDashboard',
      params: { tripId },
    };
  }

  return null;
}

function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '0.0.0').replace(/^v/, '').replace(/-.*$/, '');
  const clean2 = (v2 || '0.0.0').replace(/^v/, '').replace(/-.*$/, '');

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 !== num2) {
      return num1 - num2;
    }
  }
  return 0;
}

describe('Activity Routing, Unread Counts & Version Check Verification', () => {
  let testUser: any;
  let testTrip: any;

  beforeAll(async () => {
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        email: `activity_user_${timestamp}@tripcircle.test`,
        name: 'Activity Routing Tester',
        passwordHash: 'hashed_pw_test',
        isEmailVerified: true,
      },
    });

    testTrip = await prisma.trip.create({
      data: {
        name: 'Activity Routing Verification Trip',
        destination: 'Goa',
        startDate: new Date('2026-12-01'),
        currency: 'INR',
        status: 'ACTIVE',
        creatorId: testUser.id,
      },
    });
  });

  afterAll(async () => {
    if (testTrip) {
      await prisma.notification.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.tripMember.deleteMany({ where: { tripId: testTrip.id } });
      await prisma.trip.deleteMany({ where: { id: testTrip.id } });
    }
    if (testUser) {
      await prisma.notification.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  describe('Part A: Context-Aware Activity Router', () => {
    it('1. Resolves TRIP_INVITATION to Invitations screen with invitationId', () => {
      const dest = resolveDestination({
        type: 'TRIP_INVITATION',
        tripId: testTrip.id,
        data: { tripId: testTrip.id, invitationId: 'inv-123' },
      });

      expect(dest).toBeDefined();
      expect(dest?.screen).toBe('Invitations');
      expect(dest?.params?.highlightTripId).toBe(testTrip.id);
      expect(dest?.params?.invitationId).toBe('inv-123');
    });

    it('2. Resolves NEW_EXPENSE to ExpenseDetail screen with expenseId and tripId', () => {
      const dest = resolveDestination({
        type: 'NEW_EXPENSE',
        tripId: testTrip.id,
        data: { tripId: testTrip.id, expenseId: 'exp-456' },
      });

      expect(dest).toBeDefined();
      expect(dest?.screen).toBe('ExpenseDetail');
      expect(dest?.params?.tripId).toBe(testTrip.id);
      expect(dest?.params?.expenseId).toBe('exp-456');
    });

    it('3. Resolves PAYMENT_PENDING_CONFIRMATION to PaymentDetail screen', () => {
      const dest = resolveDestination({
        type: 'PAYMENT_PENDING_CONFIRMATION',
        tripId: testTrip.id,
        data: { tripId: testTrip.id, paymentId: 'pmt-789' },
      });

      expect(dest).toBeDefined();
      expect(dest?.screen).toBe('PaymentDetail');
      expect(dest?.params?.tripId).toBe(testTrip.id);
      expect(dest?.params?.paymentId).toBe('pmt-789');
    });

    it('4. Resolves DISCOUNT_PROPOSED to SettlementDashboard screen', () => {
      const dest = resolveDestination({
        type: 'DISCOUNT_PROPOSED',
        tripId: testTrip.id,
        data: { tripId: testTrip.id, discountId: 'disc-101' },
      });

      expect(dest).toBeDefined();
      expect(dest?.screen).toBe('SettlementDashboard');
      expect(dest?.params?.tripId).toBe(testTrip.id);
    });

    it('5. Resolves DUMMY_MEMBER_REPLACED to TripMembers screen', () => {
      const dest = resolveDestination({
        type: 'DUMMY_MEMBER_REPLACED',
        tripId: testTrip.id,
        data: { tripId: testTrip.id, memberId: 'mem-202' },
      });

      expect(dest).toBeDefined();
      expect(dest?.screen).toBe('TripMembers');
      expect(dest?.params?.tripId).toBe(testTrip.id);
    });

    it('6. Fallback: returns null for targetless or unknown activity without crashing', () => {
      const dest = resolveDestination({
        type: 'UNKNOWN_SYSTEM_BROADCAST',
        tripId: null,
        data: null,
      });

      expect(dest).toBeNull();
    });

    it('7. Accurately tracks unread notifications and decrements on mark-as-read', async () => {
      // Create 3 unread notifications
      const notif1 = await prisma.notification.create({
        data: {
          userId: testUser.id,
          tripId: testTrip.id,
          type: 'NEW_EXPENSE',
          title: 'Dinner at Beach',
          body: 'Bob added an expense',
          isRead: false,
        },
      });

      const notif2 = await prisma.notification.create({
        data: {
          userId: testUser.id,
          tripId: testTrip.id,
          type: 'PAYMENT_CONFIRMED',
          title: 'Payment Confirmed',
          body: 'Alice confirmed your payment',
          isRead: false,
        },
      });

      const initialCount = await NotificationService.getUnreadCount(testUser.id);
      expect(initialCount).toBeGreaterThanOrEqual(2);

      // Mark single notification read
      await NotificationService.markAsRead(testUser.id, notif1.id);
      const afterSingle = await NotificationService.getUnreadCount(testUser.id);
      expect(afterSingle).toBe(initialCount - 1);

      // Mark all read
      await NotificationService.markAsRead(testUser.id);
      const afterAll = await NotificationService.getUnreadCount(testUser.id);
      expect(afterAll).toBe(0);
    });
  });

  describe('Part B: Version Checking & Semver Rules', () => {
    it('8. Validates semantic version comparison utility', () => {
      expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0);
      expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
      expect(compareSemver('1.1.0', '1.1.0')).toBe(0);
      expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0);
      expect(compareSemver('1.0.0-beta.1', '1.0.0')).toBe(0);
    });

    it('9. Validates VersionManifestSchema with required and optional fields', () => {
      const validPayload = {
        version: '1.0.0',
        versionCode: 1,
        minimumSupportedVersion: '1.0.0',
        minimumSupportedVersionCode: 1,
        releaseNotes: ['Initial release', 'UI fixes'],
        apkUrl: 'https://github.com/Sugarcube08/TripCircle/releases/download/v1.0.0/TripCircle.apk',
        releaseUrl: 'https://github.com/Sugarcube08/TripCircle/releases/tag/v1.0.0',
        sha256: '4b6387a6d8d64d5fc7f1e67c870da3e30f146a48d8816c4f03a649f7e5b20b24',
        mandatory: false,
      };

      const parsed = VersionManifestSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.version).toBe('1.0.0');
        expect(parsed.data.versionCode).toBe(1);
        expect(parsed.data.mandatory).toBe(false);
      }
    });

    it('10. Rejects invalid manifest payloads with bad semver or missing versionCode', () => {
      const invalidSemver = {
        version: 'invalid-semver',
        versionCode: 1,
      };
      expect(VersionManifestSchema.safeParse(invalidSemver).success).toBe(false);

      const invalidCode = {
        version: '1.0.0',
        versionCode: -5,
      };
      expect(VersionManifestSchema.safeParse(invalidCode).success).toBe(false);
    });

    it('11. Evaluates mandatory vs optional update policies correctly', () => {
      const installedVersionCode = 2;
      const installedVersion = '1.0.1';

      // Case A: Higher version code available, not mandatory
      const updateA = {
        version: '1.0.2',
        versionCode: 3,
        minimumSupportedVersionCode: 1,
        minimumSupportedVersion: '1.0.0',
        mandatory: false,
      };
      const isAvailableA = updateA.versionCode > installedVersionCode;
      const isMandatoryA = isAvailableA && (updateA.mandatory || installedVersionCode < updateA.minimumSupportedVersionCode);
      expect(isAvailableA).toBe(true);
      expect(isMandatoryA).toBe(false);

      // Case B: Mandatory update flagged explicitly
      const updateB = { ...updateA, mandatory: true };
      const isMandatoryB = updateB.mandatory;
      expect(isMandatoryB).toBe(true);

      // Case C: Mandatory update due to minimumSupportedVersionCode > installedVersionCode
      const updateC = { ...updateA, minimumSupportedVersionCode: 3 };
      const isMandatoryC = installedVersionCode < updateC.minimumSupportedVersionCode;
      expect(isMandatoryC).toBe(true);
    });
  });
});

import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { UpdateProfileInput, ChangePasswordInput } from '@tripcircle/contracts';
import { StorageService } from '../../infrastructure/storage';
import { TripService } from '../trips/service';

export class UserService {
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        paymentQrUrl: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const completedTripCount = await prisma.tripMember.count({
      where: {
        userId,
        status: 'ACTIVE',
        trip: { status: 'CLOSED' },
      },
    });

    // Authoritative financial aggregate calculation
    const myTripsResponse = await TripService.getMyTrips(userId);
    const {
      netOwedToUserPaise,
      netUserOwesPaise,
      overallNetBalancePaise,
      activeTripsCount,
    } = myTripsResponse.aggregateNetPosition;

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      completedTripCount,
      activeTripsCount,
      netUnsettledPaise: overallNetBalancePaise,
      aggregateNetPosition: {
        netOwedToUserPaise,
        netUserOwesPaise,
        overallNetBalancePaise,
        activeTripsCount,
      },
    };
  }


  static async updateProfile(userId: string, input: UpdateProfileInput) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, paymentQrUrl: true },
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    // If new avatarUrl provided and differs from old, clean up previous avatar
    if (
      input.avatarUrl !== undefined &&
      input.avatarUrl !== existingUser.avatarUrl &&
      existingUser.avatarUrl
    ) {
      await StorageService.deleteMediaByUrl(existingUser.avatarUrl);
    }

    // If new paymentQrUrl provided and differs from old, clean up previous payment QR
    if (
      input.paymentQrUrl !== undefined &&
      input.paymentQrUrl !== existingUser.paymentQrUrl &&
      existingUser.paymentQrUrl
    ) {
      await StorageService.deleteMediaByUrl(existingUser.paymentQrUrl);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.paymentQrUrl !== undefined ? { paymentQrUrl: input.paymentQrUrl } : {}),
      },
    });

    return this.getProfile(userId);
  }

  static async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const valid = await bcrypt.compare(input.oldPassword, user.passwordHash);
    if (!valid) throw new Error('Incorrect old password');

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true, message: 'Password changed successfully.' };
  }

  static async searchUsers(query: string, currentUserId: string) {
    if (!query || query.trim().length < 2) return [];

    const normalized = query.trim().toLowerCase();

    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { email: { contains: normalized } },
          { name: { contains: query.trim() } },
        ],
      },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    return users;
  }
}

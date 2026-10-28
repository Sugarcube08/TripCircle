import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../lib/jwt';
import {
  generateSecureOtp,
  hashOtp,
  sendOtpEmail,
} from '../../lib/email';
import {
  RegisterInput,
  LoginInput,
  VerifyOtpInput,
  ResetPasswordInput,
} from '@tripcircle/contracts';
import { verifyRegistrationQrToken } from '../../lib/registration-token';

export class AuthService {
  static async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new Error('Email is already registered. Please log in.');
    }

    if (!input.paymentQrUrl && !input.paymentQrToken) {
      throw new Error('Payment QR code image is required to register.');
    }

    let finalQrUrl = input.paymentQrUrl;
    let qrMetadata: { storageKey: string; originalName: string; mimeType: string; sizeBytes: number } | null = null;

    if (input.paymentQrToken) {
      const verified = verifyRegistrationQrToken(input.paymentQrToken);
      finalQrUrl = `/api/v1/files/${encodeURIComponent(verified.storageKey)}`;
      qrMetadata = verified;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        avatarUrl: input.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.name)}`,
        paymentQrUrl: finalQrUrl,
        passwordHash,
        isEmailVerified: false,
      },
    });

    if (qrMetadata) {
      await prisma.fileMetadata.create({
        data: {
          userId: user.id,
          fileName: qrMetadata.storageKey.split('/').pop() || qrMetadata.originalName,
          originalName: qrMetadata.originalName,
          mimeType: qrMetadata.mimeType,
          sizeBytes: qrMetadata.sizeBytes,
          storageKey: qrMetadata.storageKey,
          publicUrl: finalQrUrl,
        },
      });
    }

    // Generate and send OTP for verification
    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otpToken.create({
      data: {
        email: user.email,
        otpHash,
        purpose: 'EMAIL_VERIFY',
        expiresAt,
      },
    });

    await sendOtpEmail(user.email, otp, 'EMAIL_VERIFY');

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      message: 'Registration successful. Please verify the OTP sent to your email.',
    };
  }

  static async verifyOtp(input: VerifyOtpInput) {
    const hashed = hashOtp(input.otp);

    const otpRecord = await prisma.otpToken.findFirst({
      where: {
        email: input.email,
        purpose: input.purpose,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new Error('Invalid or expired OTP. Please request a new one.');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new Error('OTP has expired. Please request a new one.');
    }

    if (otpRecord.attempts >= 5) {
      throw new Error('Too many failed attempts. Please request a new OTP.');
    }

    if (otpRecord.otpHash !== hashed) {
      await prisma.otpToken.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new Error('Invalid OTP code.');
    }

    // Mark OTP as used
    await prisma.otpToken.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    if (input.purpose === 'EMAIL_VERIFY') {
      const user = await prisma.user.update({
        where: { email: input.email },
        data: { isEmailVerified: true },
      });

      const accessToken = generateAccessToken({ userId: user.id, email: user.email });
      const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

      await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          paymentQrUrl: user.paymentQrUrl,
          isEmailVerified: true,
        },
      };
    }

    return { success: true, message: 'OTP verified successfully.' };
  }

  static async resendOtp(email: string, purpose: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't leak user existence
      return { success: true, message: 'If this email is registered, a new OTP has been sent.' };
    }

    // Invalidate existing unused tokens
    await prisma.otpToken.deleteMany({
      where: { email, purpose, usedAt: null },
    });

    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpToken.create({
      data: {
        email,
        otpHash,
        purpose,
        expiresAt,
      },
    });

    await sendOtpEmail(email, otp, purpose);

    return { success: true, message: 'A new verification OTP has been sent.' };
  }

  static async login(input: LoginInput, userAgent?: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password.');
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'),
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Completed trip count
    const completedTripCount = await prisma.tripMember.count({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        trip: { status: 'CLOSED' },
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        paymentQrUrl: user.paymentQrUrl,
        isEmailVerified: user.isEmailVerified,
        completedTripCount,
      },
    };
  }

  static async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new Error('Unauthorized: Invalid or expired refresh token');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await prisma.session.findFirst({
      where: {
        userId: payload.userId,
        refreshTokenHash: tokenHash,
        revokedAt: null,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Unauthorized: Session expired or revoked');
    }

    // Rotate refresh token
    const newAccessToken = generateAccessToken({ userId: payload.userId, email: payload.email });
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, email: payload.email });
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.session.updateMany({
      where: { refreshTokenHash: tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: true, message: 'If your email is registered, you will receive a reset OTP.' };
    }

    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpToken.create({
      data: {
        email,
        otpHash,
        purpose: 'PASSWORD_RESET',
        expiresAt,
      },
    });

    await sendOtpEmail(email, otp, 'PASSWORD_RESET');

    return { success: true, message: 'If your email is registered, you will receive a reset OTP.' };
  }

  static async resetPassword(input: ResetPasswordInput) {
    const hashed = hashOtp(input.otp);
    const otpRecord = await prisma.otpToken.findFirst({
      where: {
        email: input.email,
        purpose: 'PASSWORD_RESET',
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.otpHash !== hashed || otpRecord.expiresAt < new Date()) {
      throw new Error('Invalid or expired reset OTP.');
    }

    // Mark used
    await prisma.otpToken.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    // Hash new password and update user
    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    const user = await prisma.user.update({
      where: { email: input.email },
      data: { passwordHash },
    });

    // Invalidate all existing sessions
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });

    return { success: true, message: 'Password reset successfully. Please log in.' };
  }
}

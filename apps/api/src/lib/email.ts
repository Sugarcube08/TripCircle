import crypto from 'crypto';
import { EmailService } from '../modules/notifications/email/email.service';

export function generateSecureOtp(): string {
  // 6-digit numeric OTP cryptographically random
  const buffer = crypto.randomBytes(3);
  const num = (buffer.readUIntBE(0, 3) % 900000) + 100000;
  return num.toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function sendOtpEmail(
  email: string,
  otp: string,
  purpose: 'EMAIL_VERIFY' | 'PASSWORD_RESET'
) {
  return EmailService.sendOtpEmail(email, otp, purpose);
}

export { EmailService };

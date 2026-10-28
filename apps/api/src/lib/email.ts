import crypto from 'crypto';
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@tripcircle.app';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export function generateSecureOtp(): string {
  // 6-digit numeric OTP cryptographically random
  const buffer = crypto.randomBytes(3);
  const num = (buffer.readUIntBE(0, 3) % 900000) + 100000;
  return num.toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function sendOtpEmail(email: string, otp: string, purpose: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
  const isReset = purpose === 'PASSWORD_RESET';
  const subject = isReset ? 'tripCircle — Password Reset OTP' : 'tripCircle — Email Verification OTP';
  const textBody = isReset
    ? `Your password reset code is ${otp}. This code is valid for 10 minutes. If you did not request this, please ignore this email.`
    : `Welcome to tripCircle! Your verification code is ${otp}. This code is valid for 10 minutes.`;

  try {
    const t = getTransporter();
    await t.sendMail({
      from: SMTP_FROM,
      to: email,
      subject,
      text: textBody,
    });
    console.log(`[Email] OTP sent to ${email} for ${purpose}`);
  } catch (err) {
    // For local dev or test environments when SMTP server is not active, log securely to console
    console.warn(`[Email Warning] SMTP delivery failed (${(err as Error).message}). Dev fallback mode.`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV OTP NOTIFICATION] To: ${email} | Code: ${otp} | Purpose: ${purpose}`);
    }
  }
}

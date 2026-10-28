import nodemailer from 'nodemailer';
import { getEnv } from '../../../lib/env';

let cachedTransporter: nodemailer.Transporter | null = null;

export function getSmtpTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;

  const env = getEnv();

  const isExplicitTls = env.SMTP_PORT === 465;

  const transportOptions: nodemailer.TransportOptions = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: isExplicitTls || env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD,
          }
        : undefined,
    tls: {
      // In production, enforce TLS certificate verification
      rejectUnauthorized: env.NODE_ENV === 'production',
      ciphers: 'SSLv3',
    },
    // Pool connections to avoid opening fresh sockets for every message
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 3000,
    greetingTimeout: 3000,
    socketTimeout: 3000,
  } as any;

  cachedTransporter = nodemailer.createTransport(transportOptions);
  return cachedTransporter;
}

/**
 * Verifies SMTP transport connectivity without sending an actual email.
 * Safe for health checks.
 */
export async function verifySmtpConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  const env = getEnv();

  // In test environment, return success mock
  if (env.NODE_ENV === 'test') {
    return { connected: true };
  }

  // If not configured in development, report unconfigured without throwing
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
    return {
      connected: false,
      error: 'SMTP credentials not configured (development fallback mode)',
    };
  }

  try {
    const transporter = getSmtpTransporter();
    await transporter.verify();
    return { connected: true };
  } catch (err) {
    const message = (err as Error).message;
    return {
      connected: false,
      error: `SMTP connection verification failed: ${message}`,
    };
  }
}

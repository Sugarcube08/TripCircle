import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/prisma';
import { getEnv, getSanitizedConfigSummary } from '@/lib/env';
import { EmailService } from '@/modules/notifications/email/email.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getEnv();
  const dbHealth = await checkDatabaseHealth();

  const isHealthy = dbHealth.status === 'connected';

  const responsePayload = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'tripCircle API',
    version: '1.0.0',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: {
      status: dbHealth.status,
      latencyMs: dbHealth.latencyMs,
      ...(dbHealth.error ? { error: dbHealth.error } : {}),
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      bucket: env.R2_BUCKET_NAME,
      configured: Boolean(
        env.STORAGE_DRIVER === 'local' ||
        (env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY)
      ),
    },
    email: {
      provider: 'Gmail SMTP',
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      configured: Boolean(env.SMTP_USER && env.SMTP_PASSWORD),
    },
  };

  return NextResponse.json(responsePayload, {
    status: isHealthy ? 200 : 503,
  });
}

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),

  // API & Public URLs
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:8081'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_CONNECTION_LIMIT: z
    .string()
    .optional()
    .default('10')
    .transform((v) => parseInt(v, 10)),

  // Auth / JWT
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters').default('dev-jwt-access-secret-32-chars-min!'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters').default('dev-jwt-refresh-secret-32-chars-min!'),

  // Gmail / SMTP
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z
    .string()
    .default('587')
    .transform((v) => parseInt(v, 10)),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true' || v === '1'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM_NAME: z.string().default('TripCircle'),
  SMTP_FROM_EMAIL: z.string().email().optional().or(z.literal('')).default('noreply@tripcircle.app'),

  // Cloudflare R2
  STORAGE_DRIVER: z.enum(['r2', 'local']).default('local'),
  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET_NAME: z.string().default('tripcircle-assets'),
  R2_ENDPOINT: z.string().optional().default(''),
  R2_REGION: z.string().default('auto'),
  R2_PUBLIC_BASE_URL: z.string().optional().default(''),

  // File Upload Limits
  FILE_MAX_SIZE_BYTES: z
    .string()
    .default('10485760')
    .transform((v) => parseInt(v, 10)),
  FILE_ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/webp,application/pdf'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  // Support backwards compatibility for SMTP_PASS
  const rawEnv = {
    ...process.env,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '',
  };

  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`\n[FATAL] Configuration validation failed:\n${errorDetails}\n`);
    throw new Error(`Invalid environment configuration:\n${errorDetails}`);
  }

  const env = parsed.data;

  // Enforce production security rules
  if (env.NODE_ENV === 'production') {
    const errors: string[] = [];

    if (env.JWT_ACCESS_SECRET.startsWith('dev-')) {
      errors.push('JWT_ACCESS_SECRET cannot use default development secret in production');
    }
    if (env.JWT_REFRESH_SECRET.startsWith('dev-')) {
      errors.push('JWT_REFRESH_SECRET cannot use default development secret in production');
    }
    if (env.STORAGE_DRIVER === 'r2') {
      if (!env.R2_ACCOUNT_ID && !env.R2_ENDPOINT) {
        errors.push('R2_ACCOUNT_ID or R2_ENDPOINT is required when STORAGE_DRIVER is r2');
      }
      if (!env.R2_ACCESS_KEY_ID) {
        errors.push('R2_ACCESS_KEY_ID is required when STORAGE_DRIVER is r2');
      }
      if (!env.R2_SECRET_ACCESS_KEY) {
        errors.push('R2_SECRET_ACCESS_KEY is required when STORAGE_DRIVER is r2');
      }
    }
    if (env.SMTP_USER && !env.SMTP_PASSWORD) {
      errors.push('SMTP_PASSWORD is required when SMTP_USER is configured in production');
    }

    if (errors.length > 0) {
      const msg = `\n[FATAL] Production configuration constraints violated:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`;
      console.error(msg);
      throw new Error(msg);
    }
  }

  cachedEnv = env;
  return cachedEnv;
}

/**
 * Returns a safe diagnostic summary with masked credentials.
 * Never logs raw secrets or full passwords.
 */
export function getSanitizedConfigSummary(): Record<string, string | number | boolean> {
  const env = getEnv();
  return {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    API_BASE_URL: env.API_BASE_URL,
    APP_PUBLIC_URL: env.APP_PUBLIC_URL,
    DATABASE_URL_CONFIGURED: Boolean(env.DATABASE_URL),
    DATABASE_CONNECTION_LIMIT: env.DATABASE_CONNECTION_LIMIT,
    STORAGE_DRIVER: env.STORAGE_DRIVER,
    R2_BUCKET_NAME: env.R2_BUCKET_NAME,
    R2_CONFIGURED: Boolean(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY),
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT,
    SMTP_SECURE: env.SMTP_SECURE,
    SMTP_CONFIGURED: Boolean(env.SMTP_USER && env.SMTP_PASSWORD),
    SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL,
    FILE_MAX_SIZE_BYTES: env.FILE_MAX_SIZE_BYTES,
    FILE_ALLOWED_MIME_TYPES: env.FILE_ALLOWED_MIME_TYPES,
  };
}

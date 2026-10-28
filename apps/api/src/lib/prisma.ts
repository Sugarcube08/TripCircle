import { PrismaClient } from '@prisma/client';
import { getEnv } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const env = getEnv();
  let dbUrl = env.DATABASE_URL;

  // Append connection_limit if not already explicitly defined in URL
  if (env.DATABASE_CONNECTION_LIMIT && !dbUrl.includes('connection_limit=')) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    dbUrl = `${dbUrl}${separator}connection_limit=${env.DATABASE_CONNECTION_LIMIT}`;
  }

  const client = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log:
      env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : env.NODE_ENV === 'test'
        ? ['error']
        : ['error'],
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Health check helper to verify database responsiveness and query latency
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'disconnected';
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return { status: 'connected', latencyMs };
  } catch (err) {
    return {
      status: 'disconnected',
      error: (err as Error).message,
    };
  }
}

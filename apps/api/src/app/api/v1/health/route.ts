import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'healthy',
      service: 'tripCircle API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'tripCircle API',
        timestamp: new Date().toISOString(),
        error: (err as Error).message,
      },
      { status: 503 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { processOutboxEvents, recoverStuckEvents } from '@/lib/outbox';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Optional bearer token or cron secret validation
    const authHeader = req.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
    }

    await recoverStuckEvents();
    const result = await processOutboxEvents(50);

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

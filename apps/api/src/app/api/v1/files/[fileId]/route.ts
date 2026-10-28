import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/jwt';
import { StorageService, getStorageDriver } from '@/infrastructure/storage';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const rawFileId = decodeURIComponent(params.fileId);

    // 1. Authenticate user from header or query param
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const urlObj = new URL(req.url);
    const tokenQuery = urlObj.searchParams.get('token');

    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (tokenQuery) {
      token = tokenQuery;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to access private file' },
        { status: 401 }
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      );
    }

    // 2. Locate FileMetadata record
    const file = await prisma.fileMetadata.findFirst({
      where: {
        OR: [
          { id: rawFileId },
          { fileName: rawFileId },
          { storageKey: rawFileId },
        ],
      },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 3. Authorize access
    const { downloadUrl, mimeType, fileName } = await StorageService.getAuthorizedDownloadUrl(
      file.storageKey,
      payload.userId
    );

    // If client requested URL format or JSON
    const format = urlObj.searchParams.get('format');
    const acceptHeader = req.headers.get('accept') || '';

    if (format === 'url' || acceptHeader.includes('application/json')) {
      return NextResponse.json({
        data: {
          downloadUrl,
          fileName,
          mimeType,
          expiresInSeconds: 900,
        },
      });
    }

    // Direct download/viewing
    const env = getEnv();
    if (env.STORAGE_DRIVER === 'r2') {
      return NextResponse.redirect(downloadUrl, 302);
    } else {
      const buffer = await StorageService.getFileBuffer(file.storageKey);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Cache-Control': 'private, max-age=300',
        },
      });
    }
  } catch (err: any) {
    const status = err.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

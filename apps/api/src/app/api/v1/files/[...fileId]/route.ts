import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/jwt';
import { StorageService, getStorageDriver } from '@/infrastructure/storage';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string | string[] } }
) {
  try {
    const segments = Array.isArray(params.fileId) ? params.fileId : [params.fileId];
    // Decodes both individual segments and combined storage key path
    const rawFileId = segments.map((s) => decodeURIComponent(s)).join('/');

    // 1. Locate FileMetadata record by ID, fileName, storageKey, or publicUrl
    const lastSegment = segments[segments.length - 1] ? decodeURIComponent(segments[segments.length - 1]) : rawFileId;
    let file = await prisma.fileMetadata.findFirst({
      where: {
        OR: [
          { id: rawFileId },
          { id: lastSegment },
          { fileName: lastSegment },
          { storageKey: rawFileId },
          { storageKey: { endsWith: lastSegment } },
          { publicUrl: { contains: rawFileId } },
        ],
      },
    });

    // 2. If not in DB, verify if file directly exists in storage driver (auto-healing)
    if (!file) {
      const driver = getStorageDriver();
      const verification = await driver.verifyObject(rawFileId);
      if (verification.exists) {
        const isPng = rawFileId.toLowerCase().endsWith('.png');
        const isWebp = rawFileId.toLowerCase().endsWith('.webp');
        const isPdf = rawFileId.toLowerCase().endsWith('.pdf');
        const mimeType = isPng
          ? 'image/png'
          : isWebp
          ? 'image/webp'
          : isPdf
          ? 'application/pdf'
          : 'image/jpeg';

        file = await prisma.fileMetadata.create({
          data: {
            storageKey: rawFileId,
            fileName: lastSegment,
            originalName: lastSegment,
            mimeType,
            sizeBytes: verification.sizeBytes || 0,
            publicUrl: `${getEnv().API_BASE_URL}/api/v1/files/${encodeURIComponent(rawFileId)}`,
          },
        }).catch(() => null);
      }
    }

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // 3. Determine if file is a public media asset (avatars, trip covers, payment QRs)
    const isPublicMedia =
      file.storageKey.includes('/avatars/') ||
      file.storageKey.includes('/covers/') ||
      file.storageKey.includes('/payment-qr/') ||
      file.storageKey.includes('/registration-qr/') ||
      file.storageKey.startsWith('temp/');

    // 4. Authenticate user from header or query param for private assets
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const urlObj = new URL(req.url);
    const tokenQuery = urlObj.searchParams.get('token');

    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (tokenQuery) {
      token = tokenQuery;
    }

    let requestingUserId = file.userId || 'public';

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload?.userId) {
        requestingUserId = payload.userId;
      }
    } else if (!isPublicMedia) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to access private file' },
        { status: 401 }
      );
    }

    // 5. Authorize access
    const { downloadUrl, mimeType, fileName } = await StorageService.getAuthorizedDownloadUrl(
      file.storageKey,
      requestingUserId
    );

    // If client requested JSON format or URL redirect
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

    // 6. Direct binary streaming (immune to 302 redirect issues, S3 CORS, and presigned expiration)
    const buffer = await StorageService.getFileBuffer(file.storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType || file.mimeType || 'image/jpeg',
        'Content-Disposition': `inline; filename="${fileName || file.fileName}"`,
        'Cache-Control': isPublicMedia
          ? 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
          : 'private, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (err: any) {
    const status = err.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

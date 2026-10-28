import { prisma } from '../../lib/prisma';
import { saveUploadedFile } from '../../lib/storage';

export class FileService {
  static async uploadFile(
    userId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    tripId?: string
  ) {
    const { fileName, storageKey, publicUrl } = await saveUploadedFile(
      fileBuffer,
      originalName,
      mimeType
    );

    const metadata = await prisma.fileMetadata.create({
      data: {
        userId,
        tripId,
        fileName,
        originalName,
        mimeType,
        sizeBytes: fileBuffer.length,
        storageKey,
        publicUrl,
      },
    });

    return metadata;
  }
}

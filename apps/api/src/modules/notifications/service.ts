import { prisma } from '../../lib/prisma';

export class NotificationService {
  static async listNotifications(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications;
  }

  static async markAsRead(userId: string, notificationId?: string) {
    if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    }

    return { success: true };
  }

  static async registerPushToken(userId: string, token: string, platform = 'expo') {
    const record = await prisma.pushDeviceToken.upsert({
      where: {
        userId_token: { userId, token },
      },
      update: { platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });

    return record;
  }
}

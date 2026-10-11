import { Injectable, NotFoundException } from '@nestjs/common';
import { Alert } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForAlert(alert: Alert) {
    return this.prisma.notification.create({
      data: {
        organizationId: alert.organizationId,
        userId: alert.userId,
        alertId: alert.id,
        titleFa: alert.titleFa,
        bodyFa: alert.messageFa,
      },
    });
  }

  async list(user: AuthUser, take = 50, skip = 0) {
    const where = { organizationId: user.organizationId, userId: user.id };
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, total, unreadCount, take, skip };
  }

  async markRead(user: AuthUser, id: string) {
    const item = await this.prisma.notification.findFirst({
      where: { id, userId: user.id, organizationId: user.organizationId },
    });
    if (!item) throw new NotFoundException('اعلان یافت نشد');
    if (item.readAt) return item;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(user: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        organizationId: user.organizationId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PERMISSIONS } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
import { AlertNotesDto } from './dto/alert-notes.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  private canManage(user: AuthUser) {
    return user.permissions.includes(PERMISSIONS.ALERTS_MANAGE);
  }

  async list(user: AuthUser, query: ListAlertsQueryDto) {
    const where: Prisma.AlertWhereInput = {
      organizationId: user.organizationId,
    };

    if (!this.canManage(user)) {
      where.userId = user.id;
    } else if (query.userId) {
      where.userId = query.userId;
    }

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const take = query.take ?? 50;
    const skip = query.skip ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.alert.count({ where }),
    ]);

    return { items, total, take, skip };
  }

  async acknowledge(user: AuthUser, id: string, dto: AlertNotesDto) {
    const alert = await this.findAccessible(user, id);
    if (alert.status === AlertStatus.RESOLVED) {
      throw new ForbiddenException('هشدار قبلاً بسته شده است');
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedById: user.id,
        notesFa: dto.notesFa ?? alert.notesFa,
      },
    });
  }

  async resolve(user: AuthUser, id: string, dto: AlertNotesDto) {
    const alert = await this.findAccessible(user, id);
    if (!this.canManage(user) && alert.userId !== user.id) {
      throw new ForbiddenException('دسترسی کافی نیست');
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: user.id,
        notesFa: dto.notesFa ?? alert.notesFa,
      },
    });
  }

  private async findAccessible(user: AuthUser, id: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!alert) throw new NotFoundException('هشدار یافت نشد');
    if (!this.canManage(user) && alert.userId !== user.id) {
      throw new ForbiddenException('دسترسی کافی نیست');
    }
    return alert;
  }
}

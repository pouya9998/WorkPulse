import { Injectable, Logger } from '@nestjs/common';
import { AlertStatus, AlertType, Prisma, WorkSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateAlertInput {
  organizationId: string;
  userId: string;
  type: AlertType;
  titleFa: string;
  messageFa: string;
  windowStart: Date;
  windowEnd: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AlertsEngineService {
  private readonly logger = new Logger(AlertsEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  buildDedupeKey(type: AlertType, userId: string, windowStart: Date): string {
    const day = windowStart.toISOString().slice(0, 10);
    return `${type}:${userId}:${day}`;
  }

  async createAlertDeduped(input: CreateAlertInput) {
    const dedupeKey = this.buildDedupeKey(input.type, input.userId, input.windowStart);

    const existing = await this.prisma.alert.findUnique({
      where: {
        organizationId_dedupeKey: {
          organizationId: input.organizationId,
          dedupeKey,
        },
      },
    });

    if (existing && existing.status !== AlertStatus.RESOLVED) {
      return { created: false, alert: existing };
    }

    if (existing?.status === AlertStatus.RESOLVED) {
      await this.prisma.alert.delete({ where: { id: existing.id } });
    }

    const alert = await this.prisma.alert.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        titleFa: input.titleFa,
        messageFa: input.messageFa,
        dedupeKey,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    await this.notifications.createForAlert(alert);
    return { created: true, alert };
  }

  async checkHeartbeatExpired() {
    const policies = await this.prisma.attendancePolicy.findMany({
      where: { isActive: true },
      select: {
        organizationId: true,
        heartbeatTimeoutMinutes: true,
      },
    });
    const timeoutByOrg = new Map(
      policies.map((p) => [p.organizationId, p.heartbeatTimeoutMinutes]),
    );

    const openSessions = await this.prisma.workSession.findMany({
      where: { status: WorkSessionStatus.OPEN },
      include: {
        user: { select: { id: true, organizationId: true, firstName: true, lastName: true } },
        device: { select: { id: true, lastHeartbeatAt: true, name: true } },
      },
    });

    const now = Date.now();
    for (const session of openSessions) {
      const timeoutMin = timeoutByOrg.get(session.organizationId) ?? 2;
      const staleMs = timeoutMin * 60_000;
      const lastHb = session.device?.lastHeartbeatAt;
      if (lastHb && now - lastHb.getTime() < staleMs) continue;

      const windowStart = new Date();
      windowStart.setUTCHours(0, 0, 0, 0);
      const windowEnd = new Date(windowStart);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

      await this.createAlertDeduped({
        organizationId: session.organizationId,
        userId: session.userId,
        type: AlertType.HEARTBEAT_EXPIRED,
        titleFa: 'Heartbeat منقضی',
        messageFa: `برای ${session.user.firstName} ${session.user.lastName} heartbeat به‌موقع دریافت نشده است.`,
        windowStart,
        windowEnd,
        metadata: {
          workSessionId: session.id,
          deviceId: session.deviceId,
          lastHeartbeatAt: lastHb?.toISOString() ?? null,
        },
      });
    }
  }

  async checkMissingWorkStarts() {
    const policies = await this.prisma.attendancePolicy.findMany({
      where: { isActive: true, isDefault: true },
    });

    const now = new Date();
    for (const policy of policies) {
      const [startH, startM] = policy.expectedWorkStartUtc.split(':').map(Number);
      const expectedStart = new Date(now);
      expectedStart.setUTCHours(startH, startM ?? 0, 0, 0);
      const graceEnd = new Date(expectedStart.getTime() + policy.graceMinutes * 60_000);
      if (now < graceEnd) continue;

      const dayStart = new Date(now);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const users = await this.prisma.user.findMany({
        where: { organizationId: policy.organizationId, status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true },
      });

      for (const user of users) {
        const sessionToday = await this.prisma.workSession.findFirst({
          where: {
            userId: user.id,
            organizationId: policy.organizationId,
            startedAt: { gte: dayStart, lt: dayEnd },
          },
        });
        if (sessionToday) continue;

        await this.createAlertDeduped({
          organizationId: policy.organizationId,
          userId: user.id,
          type: AlertType.MISSING_WORK_START,
          titleFa: 'شروع کار ثبت نشده',
          messageFa: `${user.firstName} ${user.lastName} تا پایان مهلت سیاست، شروع کار ثبت نکرده است.`,
          windowStart: dayStart,
          windowEnd: dayEnd,
          metadata: { policyId: policy.id },
        });
      }
    }
  }

  async checkAgentNotSynced() {
    const staleBefore = new Date(Date.now() - 24 * 60 * 60_000);
    const devices = await this.prisma.registeredDevice.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: staleBefore } }],
      },
      include: {
        user: { select: { id: true, organizationId: true, firstName: true, lastName: true } },
      },
    });

    const windowStart = new Date();
    windowStart.setUTCHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

    for (const device of devices) {
      await this.createAlertDeduped({
        organizationId: device.organizationId,
        userId: device.userId,
        type: AlertType.AGENT_NOT_SYNCED,
        titleFa: 'Agent همگام نشده',
        messageFa: `دستگاه «${device.name}» برای ${device.user.firstName} ${device.user.lastName} بیش از ۲۴ ساعت همگام نشده است.`,
        windowStart,
        windowEnd,
        metadata: { deviceId: device.id, lastSeenAt: device.lastSeenAt?.toISOString() ?? null },
      });
    }
  }

  /** قلاب placeholder برای تداخل جلسه — از ماژول meetings فراخوانی می‌شود */
  async notifyMeetingConflictPlaceholder(
    organizationId: string,
    userId: string,
    meetingId: string,
    workSessionId: string,
  ) {
    const windowStart = new Date();
    windowStart.setUTCHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

    await this.createAlertDeduped({
      organizationId,
      userId,
      type: AlertType.MEETING_CONFLICT,
      titleFa: 'تداخل جلسه و نشست کاری',
      messageFa: 'جلسه با نشست کاری هم‌پوشانی دارد و نیاز به بازبینی دارد.',
      windowStart,
      windowEnd,
      metadata: { meetingId, workSessionId },
    });
  }

  async runScheduledChecks() {
    try {
      await this.checkHeartbeatExpired();
      await this.checkMissingWorkStarts();
      await this.checkAgentNotSynced();
    } catch (err) {
      this.logger.error('خطا در بررسی زمان‌بندی‌شده هشدارها', err);
    }
  }
}

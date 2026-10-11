import { Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async orgOverview(actor: AuthUser) {
    const orgId = actor.organizationId;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      activeUsers,
      openSessions,
      activeDevices,
      openAlerts,
      pendingCorrections,
      meetingsUpcoming,
      pendingPayroll,
      gitlabConnection,
    ] = await Promise.all([
      this.prisma.user.count({ where: { organizationId: orgId } }),
      this.prisma.user.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      this.prisma.workSession.count({ where: { organizationId: orgId, status: 'OPEN' } }),
      this.prisma.registeredDevice.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
      this.prisma.alert.count({
        where: { organizationId: orgId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      }),
      this.prisma.attendanceCorrection.count({
        where: { organizationId: orgId, status: 'PENDING' },
      }),
      this.prisma.meeting.count({
        where: {
          organizationId: orgId,
          status: { not: 'CANCELLED' },
          startAt: { gte: new Date() },
        },
      }),
      this.prisma.compensationProposal.count({
        where: { organizationId: orgId, status: 'PENDING_REVIEW' },
      }),
      this.prisma.gitLabConnection.findUnique({ where: { organizationId: orgId } }),
    ]);

    const recentAttendance = await this.prisma.attendanceEvent.groupBy({
      by: ['type'],
      where: {
        organizationId: orgId,
        occurredAtDevice: { gte: since },
        type: { in: ['WORK_START', 'WORK_END', 'IDLE_START', 'SCREEN_LOCK'] },
      },
      _count: { _all: true },
    });

    return {
      organizationId: orgId,
      windowDays: 7,
      generatedAt: new Date().toISOString(),
      summary: {
        userCount,
        activeUsers,
        openSessions,
        activeDevices,
        openAlerts,
        pendingCorrections,
        meetingsUpcoming,
        pendingPayroll,
        gitlabStatus: gitlabConnection?.status ?? 'NOT_CONFIGURED',
        gitlabLastSyncAt: gitlabConnection?.lastSyncAt ?? null,
      },
      attendanceEventCounts: recentAttendance.map((r) => ({
        type: r.type,
        count: r._count._all,
      })),
      notesFa: [
        'این گزارش تجمیعی است و به‌تنهایی معیار بهره‌وری نیست.',
        'قطع Heartbeat یا Idle اثبات غیبت یا کاهش حقوق خودکار نیست.',
      ],
    };
  }

  async attendanceSummary(actor: AuthUser, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const sessions = await this.prisma.workSession.findMany({
      where: {
        organizationId: actor.organizationId,
        startedAt: { lte: toDate },
        OR: [{ endedAt: null }, { endedAt: { gte: fromDate } }],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 500,
    });

    const byUser = new Map<
      string,
      {
        userId: string;
        fullName: string;
        email: string;
        sessionCount: number;
        openSessions: number;
        totalMs: number;
      }
    >();

    for (const s of sessions) {
      const key = s.userId;
      const cur = byUser.get(key) || {
        userId: s.userId,
        fullName: `${s.user.firstName} ${s.user.lastName}`,
        email: s.user.email,
        sessionCount: 0,
        openSessions: 0,
        totalMs: 0,
      };
      cur.sessionCount += 1;
      if (s.status === 'OPEN') cur.openSessions += 1;
      const end = s.endedAt ?? new Date();
      const start = s.startedAt < fromDate ? fromDate : s.startedAt;
      const cappedEnd = end > toDate ? toDate : end;
      cur.totalMs += Math.max(0, cappedEnd.getTime() - start.getTime());
      byUser.set(key, cur);
    }

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      users: [...byUser.values()].map((u) => ({
        ...u,
        totalHours: Math.round((u.totalMs / 3_600_000) * 100) / 100,
      })),
      notesFa: [
        'ساعات از نشست‌های خام محاسبه شده‌اند؛ ساعات قابل پرداخت ممکن است پس از تأیید مدیر متفاوت باشد.',
      ],
    };
  }

  async exportAudit(actor: AuthUser, take = 200) {
    const items = await this.prisma.auditLog.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 1000),
      include: {
        actor: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    return {
      exportedAt: new Date().toISOString(),
      count: items.length,
      items: items.map((i) => ({
        createdAt: i.createdAt,
        action: i.action,
        entityType: i.entityType,
        entityId: i.entityId,
        actorEmail: i.actor?.email ?? null,
        actorName: i.actor ? `${i.actor.firstName} ${i.actor.lastName}` : null,
        // metadata ممکن است شامل داده حساس نباشد؛ قبلاً sanitize شده
        metadata: i.metadata,
      })),
    };
  }
}

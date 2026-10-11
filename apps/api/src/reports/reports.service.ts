import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  /**
   * Per-user foreground activity timeline for managers (admin / سرپرست).
   * Built from AppFocusInterval + work sessions for the selected day/range.
   */
  async activityTimeline(
    actor: AuthUser,
    opts: { userId: string; date?: string; from?: string; to?: string },
  ) {
    if (!actor.permissions.includes('attendance:manage')) {
      throw new ForbiddenException('فقط مدیر یا سرپرست می‌تواند گزارش فعالیت کاربران را ببیند');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: opts.userId, organizationId: actor.organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        timezone: true,
        organization: { select: { timezone: true } },
      },
    });
    if (!target) throw new NotFoundException('کاربر یافت نشد');

    const tz = target.timezone || target.organization.timezone || 'Asia/Tehran';
    const { from, to, label } = this.resolveRange(opts.date, opts.from, opts.to, tz);

    const [focus, sessions] = await Promise.all([
      this.prisma.appFocusInterval.findMany({
        where: {
          userId: target.id,
          startedAt: { lte: to },
          OR: [{ endedAt: null }, { endedAt: { gte: from } }],
        },
        orderBy: { startedAt: 'asc' },
        take: 2000,
      }),
      this.prisma.workSession.findMany({
        where: {
          userId: target.id,
          startedAt: { lte: to },
          OR: [{ endedAt: null }, { endedAt: { gte: from } }],
        },
        orderBy: { startedAt: 'asc' },
        take: 50,
      }),
    ]);

    const segments = focus.map((f, index) => {
      const start = f.startedAt < from ? from : f.startedAt;
      const end = f.endedAt ? (f.endedAt > to ? to : f.endedAt) : null;
      const endForDuration = end ?? (f.endedAt ? null : new Date() > to ? to : new Date());
      const durationMs =
        endForDuration != null
          ? Math.max(0, endForDuration.getTime() - start.getTime())
          : 0;
      const context = this.focusContext(f.appName, f.detail, f.url, f.windowTitle);
      const prev = index > 0 ? focus[index - 1] : null;
      const narrativeFa = this.focusNarrativeFa({
        isFirst: index === 0,
        leftApp: prev?.appName ?? null,
        appName: f.appName,
        context,
        at: start,
        timeZone: tz,
      });

      return {
        id: f.id,
        startedAt: start.toISOString(),
        endedAt: end?.toISOString() ?? null,
        durationMinutes: Math.round((durationMs / 60_000) * 10) / 10,
        appName: f.appName,
        processName: f.processName,
        detail: f.detail,
        url: f.url,
        windowTitle: f.windowTitle,
        context,
        narrativeFa,
        timeLabel: this.formatTimeInZone(start, tz),
      };
    });

    const storyFa = segments.map((s) => `${s.timeLabel} — ${s.narrativeFa}`);

    return {
      user: {
        id: target.id,
        fullName: `${target.firstName} ${target.lastName}`,
        email: target.email,
        jobTitle: target.jobTitle,
      },
      timezone: tz,
      rangeLabel: label,
      from: from.toISOString(),
      to: to.toISOString(),
      workSessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        startedLabel: this.formatTimeInZone(s.startedAt, tz),
        endedLabel: s.endedAt ? this.formatTimeInZone(s.endedAt, tz) : null,
      })),
      segments,
      storyFa,
      summary: {
        segmentCount: segments.length,
        distinctApps: [...new Set(segments.map((s) => s.appName))],
        totalFocusMinutes: Math.round(
          segments.reduce((acc, s) => acc + s.durationMinutes, 0) * 10,
        ) / 10,
      },
      notesFa: [
        'این گزارش بر اساس برنامهٔ فعال (foreground) دستگاه است؛ محتوای صفحه یا کلیدها ضبط نمی‌شود.',
        'عنوان پنجره / مسیر فایل / URL در صورت ارسال Agent نمایش داده می‌شود (best effort).',
        'این گزارش به‌تنهایی معیار بهره‌وری یا حقوق نیست.',
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

  private resolveRange(
    date: string | undefined,
    from: string | undefined,
    to: string | undefined,
    timeZone: string,
  ): { from: Date; to: Date; label: string } {
    if (from || to) {
      const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();
      return {
        from: fromDate,
        to: toDate,
        label: `${fromDate.toISOString()} → ${toDate.toISOString()}`,
      };
    }

    const ymd =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : this.todayYmd(timeZone);

    const fromDate = this.zonedDateTime(ymd, '00:00:00.000', timeZone);
    const toDate = this.zonedDateTime(ymd, '23:59:59.999', timeZone);
    return { from: fromDate, to: toDate, label: ymd };
  }

  private todayYmd(timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
  }

  /** Interpret local wall-clock in `timeZone` as a UTC Date. */
  private zonedDateTime(ymd: string, hms: string, timeZone: string): Date {
    const [y, mo, d] = ymd.split('-').map(Number);
    const [hh, mm, ssMs] = hms.split(':');
    const ssParts = ssMs.split('.');
    const sec = Number(ssParts[0]);
    const ms = Number(ssParts[1] || '0');
    const utcGuess = Date.UTC(y, mo - 1, d, Number(hh), Number(mm), sec, ms);
    const offset = this.timezoneOffsetMs(timeZone, new Date(utcGuess));
    return new Date(utcGuess - offset);
  }

  private timezoneOffsetMs(timeZone: string, date: Date): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = dtf.formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0');
    const asUTC = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
    return asUTC - date.getTime();
  }

  private formatTimeInZone(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private focusContext(
    appName: string,
    detail: string | null,
    url: string | null,
    windowTitle: string | null,
  ): string | null {
    if (detail?.trim()) return detail.trim();
    if (url?.trim()) {
      try {
        const u = new URL(url);
        return u.hostname + (u.pathname === '/' ? '' : u.pathname);
      } catch {
        return url.trim();
      }
    }
    if (windowTitle?.trim()) {
      const t = windowTitle.trim();
      // strip trailing " - App"
      const cut = t.replace(/\s+[—–\-|]\s+[^—–\-|]+$/, '').trim();
      return cut || t;
    }
    return null;
  }

  private focusNarrativeFa(input: {
    isFirst: boolean;
    leftApp: string | null;
    appName: string;
    context: string | null;
    at: Date;
    timeZone: string;
  }): string {
    const app = this.friendlyAppName(input.appName);
    const ctx = input.context ? ` (${input.context})` : '';
    if (input.isFirst || !input.leftApp) {
      return `باز کردن ${app}${ctx}`;
    }
    const left = this.friendlyAppName(input.leftApp);
    return `ترک ${left} و رفتن به ${app}${ctx}`;
  }

  private friendlyAppName(name: string): string {
    const n = name.trim();
    const map: Record<string, string> = {
      code: 'VS Code',
      Code: 'VS Code',
      'Visual Studio Code': 'VS Code',
      cursor: 'Cursor',
      Cursor: 'Cursor',
      chrome: 'Google Chrome',
      'Google Chrome': 'Google Chrome',
      firefox: 'Firefox',
      Firefox: 'Firefox',
      msedge: 'Microsoft Edge',
      'Microsoft Edge': 'Microsoft Edge',
      phpstorm: 'PhpStorm',
      PhpStorm: 'PhpStorm',
      slack: 'Slack',
      Slack: 'Slack',
      telegram: 'Telegram',
      Telegram: 'Telegram',
    };
    return map[n] || n;
  }
}

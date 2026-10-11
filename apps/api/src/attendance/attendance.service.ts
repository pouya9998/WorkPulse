import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceEventType,
  DeviceStateType,
  Prisma,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { DeviceAuthContext } from '../devices/device-auth.types';
import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  HeartbeatDto,
  SyncEventItemDto,
  SyncEventsDto,
  WorkActionDto,
} from './dto/sync-events.dto';

const HEARTBEAT_STALE_MS = 90_000;
const IDLE_THRESHOLD_SECONDS = 300;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService,
  ) {}

  async startWork(device: DeviceAuthContext, dto: WorkActionDto, ip?: string) {
    return this.applyWorkAction(device, dto, 'WORK_START', ip);
  }

  async endWork(device: DeviceAuthContext, dto: WorkActionDto, ip?: string) {
    return this.applyWorkAction(device, dto, 'WORK_END', ip);
  }

  async heartbeat(device: DeviceAuthContext, dto: HeartbeatDto, ip?: string) {
    const existing = await this.prisma.heartbeatEvent.findUnique({
      where: {
        deviceId_clientEventId: {
          deviceId: device.deviceId,
          clientEventId: dto.clientEventId,
        },
      },
    });
    if (existing) {
      return { duplicate: true, heartbeatId: existing.id };
    }

    const openSession = await this.prisma.workSession.findFirst({
      where: { userId: device.userId, status: 'OPEN' },
      orderBy: { startedAt: 'desc' },
    });

    const hb = await this.prisma.heartbeatEvent.create({
      data: {
        userId: device.userId,
        deviceId: device.deviceId,
        workSessionId: openSession?.id,
        clientEventId: dto.clientEventId,
        sentAtDevice: new Date(dto.sentAtDevice),
        idleSeconds: dto.idleSeconds,
        isLocked: dto.isLocked ?? false,
        agentVersion: dto.agentVersion || device.agentVersion,
      },
    });

    await this.devices.touchSeen(device.deviceId, ip, true);

    if (dto.agentVersion && dto.agentVersion !== device.agentVersion) {
      await this.prisma.registeredDevice.update({
        where: { id: device.deviceId },
        data: { agentVersion: dto.agentVersion },
      });
    }

    // به‌روزرسانی وضعیت دستگاه بر اساس Idle/Lock
    const nextState = this.resolveState(dto.idleSeconds, dto.isLocked);
    await this.transitionState(device, openSession?.id ?? null, nextState, hb.id);

    await this.prisma.attendanceEvent.create({
      data: {
        organizationId: device.organizationId,
        userId: device.userId,
        deviceId: device.deviceId,
        workSessionId: openSession?.id,
        clientEventId: `hb-${dto.clientEventId}`,
        type: 'HEARTBEAT',
        occurredAtDevice: new Date(dto.sentAtDevice),
        payload: {
          idleSeconds: dto.idleSeconds ?? null,
          isLocked: dto.isLocked ?? false,
        },
      },
    }).catch(async (err) => {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
        throw err;
      }
    });

    return {
      duplicate: false,
      heartbeatId: hb.id,
      workSessionId: openSession?.id ?? null,
      serverTime: new Date().toISOString(),
    };
  }

  async syncEvents(device: DeviceAuthContext, dto: SyncEventsDto, ip?: string) {
    const accepted: string[] = [];
    const duplicates: string[] = [];
    const results: Array<{ clientEventId: string; status: string; eventId?: string }> = [];

    // مرتب‌سازی بر اساس زمان دستگاه برای پردازش منطقی
    const sorted = [...dto.events].sort(
      (a, b) =>
        new Date(a.occurredAtDevice).getTime() - new Date(b.occurredAtDevice).getTime(),
    );

    for (const item of sorted) {
      const outcome = await this.ingestEvent(device, item);
      if (outcome.duplicate) {
        duplicates.push(item.clientEventId);
        results.push({ clientEventId: item.clientEventId, status: 'duplicate', eventId: outcome.eventId });
      } else {
        accepted.push(item.clientEventId);
        results.push({ clientEventId: item.clientEventId, status: 'accepted', eventId: outcome.eventId });
      }
    }

    await this.devices.touchSeen(device.deviceId, ip, false);

    return {
      accepted: accepted.length,
      duplicates: duplicates.length,
      results,
      serverTime: new Date().toISOString(),
    };
  }

  async getStatusForUser(actor: AuthUser, userId?: string) {
    const targetId = userId || actor.id;
    await this.assertCanView(actor, targetId);

    const [openSession, device, recentEvents, openState] = await Promise.all([
      this.prisma.workSession.findFirst({
        where: { userId: targetId, status: 'OPEN' },
        orderBy: { startedAt: 'desc' },
        include: { device: true },
      }),
      this.prisma.registeredDevice.findFirst({
        where: { userId: targetId, status: 'ACTIVE' },
        orderBy: { lastHeartbeatAt: 'desc' },
      }),
      this.prisma.attendanceEvent.findMany({
        where: {
          userId: targetId,
          type: { not: 'HEARTBEAT' },
        },
        orderBy: { occurredAtDevice: 'desc' },
        take: 30,
      }),
      this.prisma.deviceStateInterval.findFirst({
        where: { userId: targetId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const now = Date.now();
    const heartbeatFresh = !!(
      device?.lastHeartbeatAt &&
      now - device.lastHeartbeatAt.getTime() < HEARTBEAT_STALE_MS
    );

    const displayStatus = this.computeDisplayStatus({
      hasOpenSession: !!openSession,
      heartbeatFresh,
      state: openState?.state,
      deviceActive: device?.status === 'ACTIVE',
    });

    return {
      userId: targetId,
      displayStatus,
      displayStatusFa: this.statusLabelFa(displayStatus),
      workSession: openSession
        ? {
            id: openSession.id,
            startedAt: openSession.startedAt,
            deviceName: openSession.device?.name ?? null,
          }
        : null,
      agent: device
        ? {
            deviceId: device.id,
            name: device.name,
            platform: device.platform,
            agentVersion: device.agentVersion,
            lastHeartbeatAt: device.lastHeartbeatAt,
            isOnline: heartbeatFresh,
            status: device.status,
          }
        : null,
      currentState: openState?.state ?? 'UNKNOWN',
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        typeFa: this.eventLabelFa(e.type),
        occurredAtDevice: e.occurredAtDevice,
        receivedAtServer: e.receivedAtServer,
        outOfOrder: e.outOfOrder,
      })),
      notes: [
        'قطع Heartbeat به‌تنهایی اثبات غیبت نیست.',
        'متصل بودن Agent به‌معنای کار مفید نیست.',
      ],
    };
  }

  async getTimeline(actor: AuthUser, userId?: string, from?: string, to?: string) {
    const targetId = userId || actor.id;
    await this.assertCanView(actor, targetId);

    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const [sessions, events, states] = await Promise.all([
      this.prisma.workSession.findMany({
        where: {
          userId: targetId,
          startedAt: { lte: toDate },
          OR: [{ endedAt: null }, { endedAt: { gte: fromDate } }],
        },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.attendanceEvent.findMany({
        where: {
          userId: targetId,
          occurredAtDevice: { gte: fromDate, lte: toDate },
          type: { not: 'HEARTBEAT' },
        },
        orderBy: { occurredAtDevice: 'asc' },
      }),
      this.prisma.deviceStateInterval.findMany({
        where: {
          userId: targetId,
          startedAt: { lte: toDate },
          OR: [{ endedAt: null }, { endedAt: { gte: fromDate } }],
        },
        orderBy: { startedAt: 'asc' },
      }),
    ]);

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      sessions,
      events: events.map((e) => ({
        ...e,
        typeFa: this.eventLabelFa(e.type),
        sequence: e.sequence?.toString() ?? null,
      })),
      stateIntervals: states,
    };
  }

  private async applyWorkAction(
    device: DeviceAuthContext,
    dto: WorkActionDto,
    type: 'WORK_START' | 'WORK_END',
    ip?: string,
  ) {
    const result = await this.ingestEvent(device, {
      clientEventId: dto.clientEventId,
      type,
      occurredAtDevice: dto.occurredAtDevice,
    });
    await this.devices.touchSeen(device.deviceId, ip, false);

    const openSession = await this.prisma.workSession.findFirst({
      where: { userId: device.userId, status: 'OPEN' },
      orderBy: { startedAt: 'desc' },
    });

    return {
      ...result,
      workSessionId: openSession?.id ?? null,
      workSessionStatus: openSession?.status ?? 'CLOSED',
    };
  }

  private async ingestEvent(device: DeviceAuthContext, item: SyncEventItemDto) {
    const existing = await this.prisma.attendanceEvent.findUnique({
      where: {
        deviceId_clientEventId: {
          deviceId: device.deviceId,
          clientEventId: item.clientEventId,
        },
      },
    });
    if (existing) {
      return { duplicate: true, eventId: existing.id };
    }

    const occurredAt = new Date(item.occurredAtDevice);
    const lastEvent = await this.prisma.attendanceEvent.findFirst({
      where: {
        deviceId: device.deviceId,
        type: { not: 'HEARTBEAT' },
      },
      orderBy: { occurredAtDevice: 'desc' },
    });

    const outOfOrder = !!(lastEvent && occurredAt < lastEvent.occurredAtDevice);

    if (item.type === 'WORK_START') {
      return this.handleWorkStart(device, item, occurredAt, outOfOrder);
    }
    if (item.type === 'WORK_END') {
      return this.handleWorkEnd(device, item, occurredAt, outOfOrder);
    }
    if (
      item.type === 'IDLE_START' ||
      item.type === 'IDLE_END' ||
      item.type === 'SCREEN_LOCK' ||
      item.type === 'SCREEN_UNLOCK' ||
      item.type === 'AGENT_ONLINE' ||
      item.type === 'AGENT_OFFLINE'
    ) {
      return this.handleStateEvent(device, item, occurredAt, outOfOrder);
    }

    // HEARTBEAT و سایر انواع از مسیر sync به‌صورت رویداد خام ذخیره می‌شوند
    const event = await this.prisma.attendanceEvent.create({
      data: {
        organizationId: device.organizationId,
        userId: device.userId,
        deviceId: device.deviceId,
        clientEventId: item.clientEventId,
        type: item.type,
        occurredAtDevice: occurredAt,
        sequence: item.sequence != null ? BigInt(item.sequence) : null,
        outOfOrder,
        payload: (item.payload as Prisma.InputJsonValue) ?? undefined,
      },
    });
    return { duplicate: false, eventId: event.id };
  }

  private async handleWorkStart(
    device: DeviceAuthContext,
    item: SyncEventItemDto,
    occurredAt: Date,
    outOfOrder: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const open = await tx.workSession.findFirst({
        where: { userId: device.userId, status: 'OPEN' },
      });
      if (open && !outOfOrder) {
        // نشست باز موجود — رویداد را ثبت می‌کنیم اما نشست جدید نمی‌سازیم
        const event = await tx.attendanceEvent.create({
          data: {
            organizationId: device.organizationId,
            userId: device.userId,
            deviceId: device.deviceId,
            workSessionId: open.id,
            clientEventId: item.clientEventId,
            type: 'WORK_START',
            occurredAtDevice: occurredAt,
            outOfOrder,
            payload: { note: 'session_already_open', ...(item.payload || {}) },
          },
        });
        return { duplicate: false, eventId: event.id };
      }

      const session = await tx.workSession.create({
        data: {
          organizationId: device.organizationId,
          userId: device.userId,
          deviceId: device.deviceId,
          status: 'OPEN',
          startedAt: new Date(),
          startedAtDevice: occurredAt,
        },
      });

      const event = await tx.attendanceEvent.create({
        data: {
          organizationId: device.organizationId,
          userId: device.userId,
          deviceId: device.deviceId,
          workSessionId: session.id,
          clientEventId: item.clientEventId,
          type: 'WORK_START',
          occurredAtDevice: occurredAt,
          sequence: item.sequence != null ? BigInt(item.sequence) : null,
          outOfOrder,
          payload: (item.payload as Prisma.InputJsonValue) ?? undefined,
        },
      });

      await tx.workSession.update({
        where: { id: session.id },
        data: { startEventId: event.id },
      });

      await this.closeOpenState(tx, device.deviceId, occurredAt);
      await tx.deviceStateInterval.create({
        data: {
          userId: device.userId,
          deviceId: device.deviceId,
          workSessionId: session.id,
          state: 'ACTIVE',
          startedAt: occurredAt,
          sourceEventId: event.id,
        },
      });

      return { duplicate: false, eventId: event.id };
    });
  }

  private async handleWorkEnd(
    device: DeviceAuthContext,
    item: SyncEventItemDto,
    occurredAt: Date,
    outOfOrder: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const open = await tx.workSession.findFirst({
        where: { userId: device.userId, status: 'OPEN' },
        orderBy: { startedAt: 'desc' },
      });

      const event = await tx.attendanceEvent.create({
        data: {
          organizationId: device.organizationId,
          userId: device.userId,
          deviceId: device.deviceId,
          workSessionId: open?.id,
          clientEventId: item.clientEventId,
          type: 'WORK_END',
          occurredAtDevice: occurredAt,
          sequence: item.sequence != null ? BigInt(item.sequence) : null,
          outOfOrder,
          payload: (item.payload as Prisma.InputJsonValue) ?? undefined,
        },
      });

      if (open && !outOfOrder) {
        await tx.workSession.update({
          where: { id: open.id },
          data: {
            status: 'CLOSED',
            endedAt: new Date(),
            endedAtDevice: occurredAt,
            endEventId: event.id,
          },
        });
        await this.closeOpenState(tx, device.deviceId, occurredAt);
      }

      return { duplicate: false, eventId: event.id };
    });
  }

  private async handleStateEvent(
    device: DeviceAuthContext,
    item: SyncEventItemDto,
    occurredAt: Date,
    outOfOrder: boolean,
  ) {
    const openSession = await this.prisma.workSession.findFirst({
      where: { userId: device.userId, status: 'OPEN' },
    });

    const event = await this.prisma.attendanceEvent.create({
      data: {
        organizationId: device.organizationId,
        userId: device.userId,
        deviceId: device.deviceId,
        workSessionId: openSession?.id,
        clientEventId: item.clientEventId,
        type: item.type,
        occurredAtDevice: occurredAt,
        sequence: item.sequence != null ? BigInt(item.sequence) : null,
        outOfOrder,
        payload: (item.payload as Prisma.InputJsonValue) ?? undefined,
      },
    });

    if (!outOfOrder) {
      const state = this.eventToState(item.type);
      if (state) {
        await this.transitionState(device, openSession?.id ?? null, state, event.id, occurredAt);
      }
    }

    return { duplicate: false, eventId: event.id };
  }

  private async transitionState(
    device: DeviceAuthContext,
    workSessionId: string | null,
    state: DeviceStateType,
    sourceEventId: string,
    at: Date = new Date(),
  ) {
    const current = await this.prisma.deviceStateInterval.findFirst({
      where: { deviceId: device.deviceId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (current?.state === state) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      if (current) {
        await tx.deviceStateInterval.update({
          where: { id: current.id },
          data: { endedAt: at },
        });
      }
      await tx.deviceStateInterval.create({
        data: {
          userId: device.userId,
          deviceId: device.deviceId,
          workSessionId: workSessionId ?? undefined,
          state,
          startedAt: at,
          sourceEventId,
        },
      });
    });
  }

  private async closeOpenState(
    tx: Prisma.TransactionClient,
    deviceId: string,
    at: Date,
  ) {
    await tx.deviceStateInterval.updateMany({
      where: { deviceId, endedAt: null },
      data: { endedAt: at },
    });
  }

  private resolveState(idleSeconds?: number, isLocked?: boolean): DeviceStateType {
    if (isLocked) return 'LOCKED';
    if (idleSeconds != null && idleSeconds >= IDLE_THRESHOLD_SECONDS) return 'IDLE';
    return 'ACTIVE';
  }

  private eventToState(type: AttendanceEventType): DeviceStateType | null {
    switch (type) {
      case 'IDLE_START':
        return 'IDLE';
      case 'IDLE_END':
        return 'ACTIVE';
      case 'SCREEN_LOCK':
        return 'LOCKED';
      case 'SCREEN_UNLOCK':
        return 'ACTIVE';
      case 'AGENT_OFFLINE':
        return 'OFFLINE';
      case 'AGENT_ONLINE':
        return 'ACTIVE';
      default:
        return null;
    }
  }

  private async assertCanView(actor: AuthUser, targetUserId: string) {
    if (actor.id === targetUserId) return;
    if (!actor.permissions.includes('attendance:manage') && !actor.permissions.includes('users:read')) {
      throw new ForbiddenException('مجوز مشاهده حضور دیگران را ندارید');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId: actor.organizationId },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
  }

  private computeDisplayStatus(input: {
    hasOpenSession: boolean;
    heartbeatFresh: boolean;
    state?: DeviceStateType | null;
    deviceActive: boolean;
  }): string {
    if (!input.hasOpenSession) return 'SESSION_ENDED';
    if (!input.deviceActive) return 'UNKNOWN';
    if (!input.heartbeatFresh) return 'HEARTBEAT_EXPIRED';
    if (input.state === 'LOCKED') return 'SCREEN_LOCKED';
    if (input.state === 'IDLE') return 'IDLE';
    if (input.state === 'OFFLINE') return 'DISCONNECTED';
    return 'WORKING';
  }

  private statusLabelFa(status: string): string {
    const map: Record<string, string> = {
      WORKING: 'در حال کار',
      IDLE: 'Idle',
      SCREEN_LOCKED: 'صفحه قفل‌شده',
      HEARTBEAT_EXPIRED: 'Heartbeat منقضی',
      DISCONNECTED: 'ارتباط قطع',
      UNKNOWN: 'زمان نامشخص',
      SESSION_ENDED: 'نشست پایان‌یافته',
    };
    return map[status] || status;
  }

  private eventLabelFa(type: AttendanceEventType): string {
    const map: Record<AttendanceEventType, string> = {
      WORK_START: 'شروع کار',
      WORK_END: 'پایان کار',
      HEARTBEAT: 'Heartbeat',
      IDLE_START: 'شروع Idle',
      IDLE_END: 'پایان Idle',
      SCREEN_LOCK: 'قفل صفحه',
      SCREEN_UNLOCK: 'باز شدن صفحه',
      AGENT_ONLINE: 'Agent آنلاین',
      AGENT_OFFLINE: 'Agent آفلاین',
    };
    return map[type] || type;
  }
}

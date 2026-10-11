import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { hashDeviceToken } from '../common/guards/device-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

const HEARTBEAT_STALE_MS = 90_000;

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDeviceDto, ip?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('ایمیل یا رمز عبور نادرست است');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('ایمیل یا رمز عبور نادرست است');
    }

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = hashDeviceToken(plainToken);

    const existing = await this.prisma.registeredDevice.findUnique({
      where: {
        organizationId_deviceUid: {
          organizationId: user.organizationId,
          deviceUid: dto.deviceUid,
        },
      },
    });

    let device;
    if (existing) {
      // Active device owned by someone else cannot be stolen.
      // Revoked devices can be reclaimed by a new login on the same machine.
      if (existing.userId !== user.id && existing.status !== 'REVOKED') {
        throw new ForbiddenException('این دستگاه به کاربر دیگری متصل است');
      }
      device = await this.prisma.registeredDevice.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          name: dto.name,
          platform: dto.platform,
          osVersion: dto.osVersion,
          agentVersion: dto.agentVersion,
          tokenHash,
          status: 'ACTIVE',
          revokedAt: null,
          lastSeenAt: new Date(),
          lastIpAddress: ip,
        },
      });
    } else {
      device = await this.prisma.registeredDevice.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          deviceUid: dto.deviceUid,
          name: dto.name,
          platform: dto.platform,
          osVersion: dto.osVersion,
          agentVersion: dto.agentVersion,
          tokenHash,
          lastSeenAt: new Date(),
          lastIpAddress: ip,
        },
      });
    }

    await this.audit.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'device.registered',
      entityType: 'RegisteredDevice',
      entityId: device.id,
      metadata: { platform: dto.platform, agentVersion: dto.agentVersion },
      ipAddress: ip,
    });

    return {
      deviceId: device.id,
      deviceUid: device.deviceUid,
      deviceToken: plainToken,
      userId: user.id,
      organizationId: user.organizationId,
      heartbeatIntervalSeconds: 60,
      message: 'دستگاه ثبت شد. توکن را فقط یک‌بار ذخیره کنید.',
    };
  }

  async listForActor(actor: AuthUser, userId?: string) {
    const canManage =
      actor.permissions.includes('attendance:manage') ||
      actor.permissions.includes('users:read');

    const targetUserId = userId || actor.id;
    if (targetUserId !== actor.id && !canManage) {
      throw new ForbiddenException('مجوز مشاهده دستگاه‌های دیگران را ندارید');
    }

    if (userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, organizationId: actor.organizationId },
      });
      if (!user) throw new NotFoundException('کاربر یافت نشد');
    }

    const devices = await this.prisma.registeredDevice.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(canManage && !userId ? {} : { userId: targetUserId }),
        ...(userId ? { userId } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    const now = Date.now();
    return devices.map((d) => ({
      id: d.id,
      deviceUid: d.deviceUid,
      name: d.name,
      platform: d.platform,
      osVersion: d.osVersion,
      agentVersion: d.agentVersion,
      status: d.status,
      lastSeenAt: d.lastSeenAt,
      lastHeartbeatAt: d.lastHeartbeatAt,
      isOnline: !!(
        d.status === 'ACTIVE' &&
        d.lastHeartbeatAt &&
        now - d.lastHeartbeatAt.getTime() < HEARTBEAT_STALE_MS
      ),
      revokedAt: d.revokedAt,
      createdAt: d.createdAt,
      user: d.user,
    }));
  }

  async revoke(actor: AuthUser, deviceId: string) {
    const device = await this.prisma.registeredDevice.findFirst({
      where: { id: deviceId, organizationId: actor.organizationId },
    });
    if (!device) throw new NotFoundException('دستگاه یافت نشد');

    const canManage = actor.permissions.includes('attendance:manage');
    if (device.userId !== actor.id && !canManage) {
      throw new ForbiddenException('مجوز لغو این دستگاه را ندارید');
    }

    const updated = await this.prisma.registeredDevice.update({
      where: { id: deviceId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        tokenHash: hashDeviceToken(randomBytes(32).toString('hex')),
      },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action: 'device.revoked',
      entityType: 'RegisteredDevice',
      entityId: deviceId,
    });

    return {
      id: updated.id,
      status: updated.status,
      revokedAt: updated.revokedAt,
      message: 'دسترسی دستگاه لغو شد',
    };
  }

  async touchSeen(deviceId: string, ip?: string, heartbeat = false) {
    await this.prisma.registeredDevice.update({
      where: { id: deviceId },
      data: {
        lastSeenAt: new Date(),
        lastIpAddress: ip,
        ...(heartbeat ? { lastHeartbeatAt: new Date() } : {}),
      },
    });
  }

  async meStatus(actor: AuthUser) {
    const device = await this.prisma.registeredDevice.findFirst({
      where: { userId: actor.id, status: 'ACTIVE' },
      orderBy: { lastHeartbeatAt: 'desc' },
    });
    const now = Date.now();
    const isOnline = !!(
      device?.lastHeartbeatAt &&
      now - device.lastHeartbeatAt.getTime() < HEARTBEAT_STALE_MS
    );
    const canBypassGate =
      actor.permissions.includes('users:write') ||
      actor.roles.includes('SUPER_ADMIN') ||
      actor.roles.includes('ORGANIZATION_ADMIN');

    return {
      hasDevice: !!device,
      isOnline,
      deviceId: device?.id ?? null,
      deviceName: device?.name ?? null,
      lastHeartbeatAt: device?.lastHeartbeatAt ?? null,
      agentVersion: device?.agentVersion ?? null,
      canBypassGate,
      panelUnlocked: isOnline || canBypassGate,
    };
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceAuthContext } from '../../devices/device-auth.types';

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      device?: DeviceAuthContext;
      ip?: string;
    }>();

    const token =
      request.headers['x-device-token'] ||
      request.headers['X-Device-Token'] ||
      '';

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('توکن دستگاه ارسال نشده است');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const device = await this.prisma.registeredDevice.findFirst({
      where: { tokenHash, status: 'ACTIVE' },
      include: { user: true },
    });

    if (!device || device.revokedAt) {
      throw new UnauthorizedException('دستگاه نامعتبر یا لغو شده است');
    }

    if (device.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('حساب کاربری غیرفعال است');
    }

    request.device = {
      deviceId: device.id,
      userId: device.userId,
      organizationId: device.organizationId,
      deviceUid: device.deviceUid,
      agentVersion: device.agentVersion,
      platform: device.platform,
    };

    return true;
  }
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

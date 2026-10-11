import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthUser, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('ایمیل یا رمز عبور نادرست است');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('حساب کاربری غیرفعال است');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('ایمیل یا رمز عبور نادرست است');
    }

    const roles = user.roles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
      ),
    ];

    const jti = randomUUID();
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '8h';
    const expiresAt = this.computeExpiry(expiresIn);

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenJti: jti,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ip,
        expiresAt,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles,
      permissions,
      sessionId: session.id,
      jti,
    };

    const accessToken = await this.jwt.signAsync(payload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta?.ip,
    });

    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        roles,
        permissions,
        timezone: user.timezone,
      },
    };
  }

  async logout(user: AuthUser, meta?: { ip?: string }) {
    await this.prisma.userSession.updateMany({
      where: { tokenJti: user.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'auth.logout',
      entityType: 'UserSession',
      entityId: user.sessionId,
      ipAddress: meta?.ip,
    });

    return { message: 'خروج با موفقیت انجام شد' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
        organization: true,
        teamMembers: { include: { team: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }

    const permissions = [
      ...new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      permissions,
      phone: user.phone,
      jobTitle: user.jobTitle,
      contractType: user.contractType,
      hireDate: user.hireDate,
      timezone: user.timezone,
      status: user.status,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        timezone: user.organization.timezone,
      },
      roles: user.roles.map((r) => ({
        code: r.role.code,
        nameFa: r.role.nameFa,
      })),
      teams: user.teamMembers.map((tm) => ({
        id: tm.team.id,
        name: tm.team.name,
        isLead: tm.isLead,
      })),
    };
  }

  async revokeAllSessions(userId: string, actor: AuthUser) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action: 'auth.revoke_sessions',
      entityType: 'User',
      entityId: userId,
    });

    return { message: 'تمام نشست‌های فعال لغو شدند' };
  }

  private computeExpiry(expiresIn: string): Date {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    const now = Date.now();
    if (!match) {
      return new Date(now + 8 * 60 * 60 * 1000);
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(now + value * multipliers[unit]);
  }
}

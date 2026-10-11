import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async list(actor: AuthUser, query?: { status?: UserStatus; search?: string }) {
    const where = {
      organizationId: actor.organizationId,
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { username: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        roles: { include: { role: true } },
        teamMembers: { include: { team: true } },
      },
    });

    return users.map((u) => this.toPublic(u));
  }

  async getById(actor: AuthUser, id: string) {
    const user = await this.findInOrg(actor.organizationId, id);
    return this.toPublic(user);
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    this.assertCanManageRoles(actor, dto.roles);

    const email = dto.email.toLowerCase();
    const username = (dto.username || email.split('@')[0]).toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        organizationId: actor.organizationId,
        OR: [{ email }, { username }],
      },
    });
    if (existing) {
      throw new ConflictException('کاربری با این ایمیل یا نام کاربری از قبل وجود دارد');
    }

    const roleRecords = await this.resolveRoles(dto.roles);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    if (dto.teamId) {
      await this.assertTeamInOrg(actor.organizationId, dto.teamId);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          email,
          username,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          jobTitle: dto.jobTitle,
          contractType: dto.contractType,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
          timezone: dto.timezone || 'Asia/Tehran',
          gitlabUsername: dto.gitlabUsername,
          status: UserStatus.ACTIVE,
          roles: {
            create: roleRecords.map((r) => ({ roleId: r.id })),
          },
          ...(dto.teamId
            ? {
                teamMembers: {
                  create: [{ teamId: dto.teamId }],
                },
              }
            : {}),
        },
        include: {
          roles: { include: { role: true } },
          teamMembers: { include: { team: true } },
        },
      });
      return created;
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, roles: dto.roles },
    });

    return this.toPublic(user);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const existing = await this.findInOrg(actor.organizationId, id);

    if (dto.roles) {
      this.assertCanManageRoles(actor, dto.roles);
    }

    if (dto.email || dto.username) {
      const conflict = await this.prisma.user.findFirst({
        where: {
          organizationId: actor.organizationId,
          id: { not: id },
          OR: [
            ...(dto.email ? [{ email: dto.email.toLowerCase() }] : []),
            ...(dto.username ? [{ username: dto.username.toLowerCase() }] : []),
          ],
        },
      });
      if (conflict) {
        throw new ConflictException('ایمیل یا نام کاربری تکراری است');
      }
    }

    if (dto.teamId) {
      await this.assertTeamInOrg(actor.organizationId, dto.teamId);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.roles) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        const roleRecords = await this.resolveRoles(dto.roles);
        await tx.userRole.createMany({
          data: roleRecords.map((r) => ({ userId: id, roleId: r.id })),
        });
      }

      if (dto.teamId !== undefined) {
        await tx.teamMember.deleteMany({ where: { userId: id } });
        if (dto.teamId) {
          await tx.teamMember.create({
            data: { userId: id, teamId: dto.teamId },
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email?.toLowerCase(),
          username: dto.username?.toLowerCase(),
          phone: dto.phone,
          jobTitle: dto.jobTitle,
          contractType: dto.contractType,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
          timezone: dto.timezone,
          status: dto.status,
          gitlabUsername: dto.gitlabUsername === null ? null : dto.gitlabUsername,
        },
        include: {
          roles: { include: { role: true } },
          teamMembers: { include: { team: true } },
        },
      });
    });

    if (dto.status === UserStatus.INACTIVE && existing.status === UserStatus.ACTIVE) {
      await this.auth.revokeAllSessions(id, actor);
    }

    await this.audit.log({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action: 'user.updated',
      entityType: 'User',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return this.toPublic(user);
  }

  async deactivate(actor: AuthUser, id: string) {
    if (actor.id === id) {
      throw new BadRequestException('نمی‌توانید حساب خود را غیرفعال کنید');
    }
    return this.update(actor, id, { status: UserStatus.INACTIVE });
  }

  async activate(actor: AuthUser, id: string) {
    return this.update(actor, id, { status: UserStatus.ACTIVE });
  }

  async resetPassword(actor: AuthUser, id: string, dto: ResetPasswordDto) {
    await this.findInOrg(actor.organizationId, id);
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    await this.auth.revokeAllSessions(id, actor);
    await this.audit.log({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action: 'user.password_reset',
      entityType: 'User',
      entityId: id,
    });
    return { message: 'رمز عبور به‌روزرسانی شد و نشست‌های فعال لغو گردیدند' };
  }

  async revokeSessions(actor: AuthUser, id: string) {
    await this.findInOrg(actor.organizationId, id);
    return this.auth.revokeAllSessions(id, actor);
  }

  private async findInOrg(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      include: {
        roles: { include: { role: true } },
        teamMembers: { include: { team: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    return user;
  }

  private async resolveRoles(codes: RoleCode[]) {
    if (!codes.length) {
      throw new BadRequestException('حداقل یک نقش باید انتخاب شود');
    }
    const roles = await this.prisma.role.findMany({
      where: { code: { in: codes }, organizationId: null },
    });
    if (roles.length !== codes.length) {
      throw new BadRequestException('یک یا چند نقش نامعتبر است');
    }
    return roles;
  }

  private async assertTeamInOrg(organizationId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId },
    });
    if (!team) {
      throw new BadRequestException('تیم در این سازمان یافت نشد');
    }
  }

  private assertCanManageRoles(actor: AuthUser, roles: RoleCode[]) {
    const isSuper = actor.roles.includes(RoleCode.SUPER_ADMIN);
    const isOrgAdmin = actor.roles.includes(RoleCode.ORGANIZATION_ADMIN);
    if (!isSuper && !isOrgAdmin) {
      throw new ForbiddenException('مجوز مدیریت کاربران را ندارید');
    }
    if (!isSuper && roles.includes(RoleCode.SUPER_ADMIN)) {
      throw new ForbiddenException('فقط مدیر کل می‌تواند نقش مدیر کل را تخصیص دهد');
    }
  }

  private toPublic(user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    jobTitle: string | null;
    contractType: string;
    hireDate: Date | null;
    timezone: string;
    status: UserStatus;
    gitlabUsername: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    roles: { role: { code: RoleCode; nameFa: string } }[];
    teamMembers: { team: { id: string; name: string }; isLead: boolean }[];
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      jobTitle: user.jobTitle,
      contractType: user.contractType,
      hireDate: user.hireDate,
      timezone: user.timezone,
      status: user.status,
      gitlabUsername: user.gitlabUsername,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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
}

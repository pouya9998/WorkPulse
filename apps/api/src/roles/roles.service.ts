import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import {
  PERMISSIONS,
  ROLE_LABELS_FA,
  ROLE_PERMISSION_MAP,
} from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSystemPermissionsAndRoles();
  }

  async ensureSystemPermissionsAndRoles(organizationId?: string) {
    for (const [key, code] of Object.entries(PERMISSIONS)) {
      await this.prisma.permission.upsert({
        where: { code },
        update: { nameFa: this.permissionLabel(key) },
        create: {
          code,
          nameFa: this.permissionLabel(key),
          description: code,
        },
      });
    }

    const allPermissions = await this.prisma.permission.findMany();
    const permissionByCode = new Map(allPermissions.map((p) => [p.code, p.id]));

    for (const code of Object.values(RoleCode)) {
      let role = await this.prisma.role.findFirst({
        where: {
          code,
          organizationId: organizationId ?? null,
        },
      });

      if (!role) {
        role = await this.prisma.role.create({
          data: {
            organizationId: organizationId ?? null,
            code,
            nameFa: ROLE_LABELS_FA[code] || code,
            isSystem: true,
          },
        });
      } else if (role.nameFa !== (ROLE_LABELS_FA[code] || code)) {
        role = await this.prisma.role.update({
          where: { id: role.id },
          data: { nameFa: ROLE_LABELS_FA[code] || code },
        });
      }

      const desired = ROLE_PERMISSION_MAP[code] || [];
      for (const permCode of desired) {
        const permissionId = permissionByCode.get(permCode);
        if (!permissionId) continue;
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }
    }
  }

  async list() {
    return this.prisma.role.findMany({
      where: { organizationId: null },
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findByCode(code: RoleCode) {
    return this.prisma.role.findFirst({
      where: { code, organizationId: null },
    });
  }

  private permissionLabel(key: string): string {
    const labels: Record<string, string> = {
      USERS_READ: 'مشاهده کاربران',
      USERS_WRITE: 'مدیریت کاربران',
      USERS_DEACTIVATE: 'غیرفعال‌سازی کاربران',
      TEAMS_READ: 'مشاهده تیم‌ها',
      TEAMS_WRITE: 'مدیریت تیم‌ها',
      AUDIT_READ: 'مشاهده حسابرسی',
      ORG_SETTINGS: 'تنظیمات سازمان',
      PAYROLL_READ: 'مشاهده حقوق',
      PAYROLL_REVIEW: 'بازبینی حقوق',
      ATTENDANCE_READ: 'مشاهده حضور',
      ATTENDANCE_MANAGE: 'مدیریت حضور',
      ALERTS_READ: 'مشاهده هشدارها',
      ALERTS_MANAGE: 'مدیریت هشدارها',
      MEETINGS_READ: 'مشاهده جلسات',
      MEETINGS_MANAGE: 'مدیریت جلسات',
      GITLAB_MANAGE: 'مدیریت GitLab',
      ENGINEERING_READ: 'گزارش فعالیت مهندسی',
    };
    return labels[key] || key;
  }
}

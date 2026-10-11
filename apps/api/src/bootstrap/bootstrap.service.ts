import {
  ConflictException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class BootstrapService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.roles.ensureSystemPermissionsAndRoles();
    await this.tryAutoBootstrap();
  }

  async getStatus() {
    const userCount = await this.prisma.user.count();
    const bootstrapDone = await this.prisma.bootstrapState.findFirst({
      where: { completedAt: { not: null } },
    });
    return {
      needsBootstrap: userCount === 0 && !bootstrapDone,
      completed: !!bootstrapDone?.completedAt,
      completedAt: bootstrapDone?.completedAt?.toISOString() ?? null,
    };
  }

  /**
   * Bootstrap امن: فقط وقتی هیچ کاربری وجود ندارد اجرا می‌شود.
   * پس از ایجاد مدیر، BootstrapState.completedAt پر می‌شود.
   */
  async tryAutoBootstrap() {
    const status = await this.getStatus();
    if (!status.needsBootstrap) {
      return { skipped: true, reason: 'bootstrap_already_done_or_users_exist' };
    }

    const email = this.config.get<string>('BOOTSTRAP_ADMIN_EMAIL');
    const password = this.config.get<string>('BOOTSTRAP_ADMIN_PASSWORD');
    const firstName = this.config.get<string>('BOOTSTRAP_ADMIN_FIRST_NAME') || 'مدیر';
    const lastName = this.config.get<string>('BOOTSTRAP_ADMIN_LAST_NAME') || 'سیستم';
    const orgName = this.config.get<string>('BOOTSTRAP_ORG_NAME') || 'سازمان';

    if (!email || !password) {
      return { skipped: true, reason: 'bootstrap_credentials_missing' };
    }

    return this.runBootstrap({
      email,
      password,
      firstName,
      lastName,
      orgName,
    });
  }

  async runBootstrap(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    orgName: string;
  }) {
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      throw new ConflictException('Bootstrap غیرفعال است؛ کاربرانی از قبل وجود دارند');
    }

    const completed = await this.prisma.bootstrapState.findFirst({
      where: { completedAt: { not: null } },
    });
    if (completed) {
      throw new ConflictException('Bootstrap قبلاً تکمیل شده است');
    }

    const slug = this.slugify(input.orgName);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const timezone = this.config.get<string>('DEFAULT_TIMEZONE') || 'Asia/Tehran';

    const adminRole = await this.prisma.role.findFirst({
      where: { code: RoleCode.SUPER_ADMIN, organizationId: null },
    });
    if (!adminRole) {
      throw new ConflictException('نقش مدیر کل یافت نشد؛ راه‌اندازی نقش‌ها را بررسی کنید');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.orgName,
          slug,
          timezone,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: input.email.toLowerCase(),
          username: input.email.toLowerCase().split('@')[0],
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          jobTitle: 'مدیر سامانه',
          timezone,
          status: 'ACTIVE',
          roles: {
            create: [{ roleId: adminRole.id }],
          },
        },
      });

      await tx.bootstrapState.create({
        data: {
          organizationId: org.id,
          completedAt: new Date(),
        },
      });

      return { org, user };
    });

    await this.audit.log({
      organizationId: result.org.id,
      actorUserId: result.user.id,
      action: 'bootstrap.completed',
      entityType: 'Organization',
      entityId: result.org.id,
      metadata: { adminEmail: result.user.email },
    });

    return {
      skipped: false,
      organizationId: result.org.id,
      adminUserId: result.user.id,
      adminEmail: result.user.email,
    };
  }

  private slugify(name: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]+/g, '')
      .slice(0, 40);
    return `${base || 'org'}-${Date.now().toString(36)}`;
  }
}

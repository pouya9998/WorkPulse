import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getOrgSettings(actor: AuthUser) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: actor.organizationId },
    });
    return {
      id: org.id,
      name: org.name,
      timezone: org.timezone,
      locale: org.locale,
      isActive: org.isActive,
      security: {
        jwtExpiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '8h',
        corsOrigins: (this.config.get<string>('CORS_ORIGINS') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        throttleLimit: Number(this.config.get('THROTTLE_LIMIT') || 100),
        encryptionConfigured: !!(
          this.config.get('ENCRYPTION_KEY') || this.config.get('JWT_SECRET')
        ),
        gitlabWebhookSecretConfigured: !!this.config.get('GITLAB_WEBHOOK_SECRET'),
      },
      dataRetentionFa: [
        'رویدادهای حضور و حسابرسی برای ممیزی نگهداری می‌شوند.',
        'کاربران دارای سابقه به‌صورت فیزیکی حذف نمی‌شوند؛ غیرفعال می‌شوند.',
        'توکن دستگاه و GitLab در لاگ ثبت نمی‌شوند.',
        'برای حذف Volume دیتابیس از docker compose down -v با احتیاط استفاده کنید.',
      ],
      agentPrivacyFa: [
        'Agent اسکرین‌شات، کلید، Clipboard، صدا یا تصویر ضبط نمی‌کند.',
        'رویداد حضور، Heartbeat، Idle، قفل صفحه، نام برنامهٔ فعال، عنوان پنجره و در صورت امکان URL یا مسیر فایل ارسال می‌شود.',
        'اسکرین‌شات، کیلاگر، Clipboard، صدا و ویدیو هرگز جمع‌آوری نمی‌شود.',
      ],
    };
  }

  async updateOrgSettings(
    actor: AuthUser,
    input: { name?: string; timezone?: string; locale?: string },
  ) {
    return this.prisma.organization.update({
      where: { id: actor.organizationId },
      data: {
        name: input.name,
        timezone: input.timezone,
        locale: input.locale,
      },
      select: {
        id: true,
        name: true,
        timezone: true,
        locale: true,
        isActive: true,
      },
    });
  }
}

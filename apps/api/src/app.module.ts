import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { HealthController } from './health.controller';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { AgentReleasesModule } from './agent-releases/agent-releases.module';
import { AttendanceModule } from './attendance/attendance.module';
import { GitLabModule } from './gitlab/gitlab.module';
import { PayrollModule } from './payroll/payroll.module';
import { AttendancePoliciesModule } from './attendance-policies/attendance-policies.module';
import { AttendanceCorrectionsModule } from './attendance-corrections/attendance-corrections.module';
import { AlertsModule } from './alerts/alerts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MeetingsModule } from './meetings/meetings.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('THROTTLE_TTL_MS') || 60000),
          limit: Number(config.get('THROTTLE_LIMIT') || 100),
        },
      ],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    BootstrapModule,
    OrganizationsModule,
    RolesModule,
    UsersModule,
    DevicesModule,
    AgentReleasesModule,
    AttendanceModule,
    GitLabModule,
    PayrollModule,
    AttendancePoliciesModule,
    AttendanceCorrectionsModule,
    AlertsModule,
    NotificationsModule,
    MeetingsModule,
    ReportsModule,
    SettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

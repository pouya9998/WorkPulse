import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { ReportsService } from './reports.service';

@ApiTags('گزارش‌ها')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'نمای کلی سازمان' })
  overview(@CurrentUser() user: AuthUser) {
    return this.reports.orgOverview(user);
  }

  @Get('attendance-summary')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'خلاصه حضور کاربران' })
  attendance(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.attendanceSummary(user, from, to);
  }

  @Get('audit-export')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'خروجی حسابرسی (JSON)' })
  auditExport(@CurrentUser() user: AuthUser, @Query('take') take?: string) {
    return this.reports.exportAudit(user, take ? Number(take) : 200);
  }
}

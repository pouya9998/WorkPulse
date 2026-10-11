import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { AttendanceService } from './attendance.service';

@ApiTags('حضور')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('status')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'وضعیت فعلی حضور و Agent' })
  status(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    return this.attendance.getStatusForUser(user, userId);
  }

  @Get('timeline')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'تایم‌لاین حضور' })
  timeline(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendance.getTimeline(user, userId, from, to);
  }
}

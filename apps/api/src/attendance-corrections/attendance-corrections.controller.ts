import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceCorrectionStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { AttendanceCorrectionsService } from './attendance-corrections.service';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { ReviewAttendanceCorrectionDto } from './dto/review-attendance-correction.dto';

@ApiTags('اصلاح حضور')
@ApiBearerAuth()
@Controller('attendance-corrections')
@UseGuards(PermissionsGuard)
export class AttendanceCorrectionsController {
  constructor(private readonly corrections: AttendanceCorrectionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'فهرست درخواست‌های اصلاح' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: AttendanceCorrectionStatus,
  ) {
    return this.corrections.list(user, status);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'ثبت درخواست اصلاح توسط کارمند' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAttendanceCorrectionDto) {
    return this.corrections.create(user, dto);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'تأیید درخواست اصلاح' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
  ) {
    return this.corrections.approve(user, id, dto);
  }

  @Post(':id/reject')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'رد درخواست اصلاح' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
  ) {
    return this.corrections.reject(user, id, dto);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import { RecordMeetingAttendanceDto } from './dto/meeting-attendance.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingsService } from './meetings.service';

@ApiTags('جلسات')
@ApiBearerAuth()
@Controller('meetings')
@UseGuards(PermissionsGuard)
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MEETINGS_READ)
  @ApiOperation({ summary: 'فهرست جلسات' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListMeetingsQueryDto) {
    return this.meetings.list(user, query);
  }

  @Get('calendar/events')
  @RequirePermissions(PERMISSIONS.MEETINGS_READ)
  @ApiOperation({ summary: 'رویدادهای تقویم (Adapter)' })
  calendarEvents(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 7 * 86400_000);
    return this.meetings.listCalendarEvents(user, fromDate, toDate);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MEETINGS_MANAGE)
  @ApiOperation({ summary: 'ایجاد جلسه' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMeetingDto) {
    return this.meetings.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MEETINGS_MANAGE)
  @ApiOperation({ summary: 'ویرایش جلسه' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetings.update(user, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.MEETINGS_MANAGE)
  @ApiOperation({ summary: 'لغو جلسه' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.cancel(user, id);
  }

  @Get(':id/overlaps')
  @RequirePermissions(PERMISSIONS.MEETINGS_READ)
  @ApiOperation({ summary: 'تشخیص هم‌پوشانی با نشست کاری' })
  overlaps(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.detectOverlaps(user, id);
  }

  @Post('occurrences/:occurrenceId/attendance')
  @RequirePermissions(PERMISSIONS.MEETINGS_MANAGE)
  @ApiOperation({ summary: 'ثبت دستی حضور در جلسه' })
  recordAttendance(
    @CurrentUser() user: AuthUser,
    @Param('occurrenceId') occurrenceId: string,
    @Body() dto: RecordMeetingAttendanceDto,
  ) {
    return this.meetings.recordAttendance(user, occurrenceId, dto);
  }
}

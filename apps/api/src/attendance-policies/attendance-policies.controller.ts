import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { AttendancePoliciesService } from './attendance-policies.service';
import { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';

@ApiTags('سیاست‌های حضور')
@ApiBearerAuth()
@Controller('attendance-policies')
@UseGuards(PermissionsGuard)
export class AttendancePoliciesController {
  constructor(private readonly policies: AttendancePoliciesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'فهرست سیاست‌های حضور سازمان' })
  list(@CurrentUser() user: AuthUser) {
    return this.policies.list(user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'ایجاد سیاست حضور' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAttendancePolicyDto) {
    return this.policies.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'ویرایش سیاست حضور' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAttendancePolicyDto,
  ) {
    return this.policies.update(user, id, dto);
  }
}

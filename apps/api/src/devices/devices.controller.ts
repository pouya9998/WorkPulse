import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('دستگاه‌ها')
@Controller()
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Public()
  @Post('agent/register')
  @ApiOperation({ summary: 'ثبت دستگاه Agent با ایمیل و رمز عبور کاربر' })
  register(@Body() dto: RegisterDeviceDto, @Req() req: Request) {
    return this.devices.register(dto, req.ip);
  }

  @Get('devices/me/status')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'وضعیت Agent کاربر جاری برای قفل پنل' })
  meStatus(@CurrentUser() user: AuthUser) {
    return this.devices.meStatus(user);
  }

  @Get('devices')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'فهرست دستگاه‌های ثبت‌شده' })
  list(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    return this.devices.listForActor(user, userId);
  }

  @Post('devices/:id/revoke')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: 'لغو دسترسی دستگاه' })
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.revoke(user, id);
  }
}

import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentDevice } from '../common/decorators/current-device.decorator';
import { Public } from '../common/decorators/public.decorator';
import { DeviceAuthGuard } from '../common/guards/device-auth.guard';
import { DeviceAuthContext } from '../devices/device-auth.types';
import { AttendanceService } from './attendance.service';
import { HeartbeatDto, SyncEventsDto, WorkActionDto } from './dto/sync-events.dto';

@ApiTags('Agent')
@ApiHeader({ name: 'X-Device-Token', required: true })
@Public()
@UseGuards(DeviceAuthGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('work/start')
  @ApiOperation({ summary: 'شروع کار از Agent' })
  start(
    @CurrentDevice() device: DeviceAuthContext,
    @Body() dto: WorkActionDto,
    @Req() req: Request,
  ) {
    return this.attendance.startWork(device, dto, req.ip);
  }

  @Post('work/end')
  @ApiOperation({ summary: 'پایان کار از Agent' })
  end(
    @CurrentDevice() device: DeviceAuthContext,
    @Body() dto: WorkActionDto,
    @Req() req: Request,
  ) {
    return this.attendance.endWork(device, dto, req.ip);
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Heartbeat دستگاه' })
  heartbeat(
    @CurrentDevice() device: DeviceAuthContext,
    @Body() dto: HeartbeatDto,
    @Req() req: Request,
  ) {
    return this.attendance.heartbeat(device, dto, req.ip);
  }

  @Post('events/sync')
  @ApiOperation({ summary: 'همگام‌سازی دسته‌ای رویدادها (آفلاین)' })
  sync(
    @CurrentDevice() device: DeviceAuthContext,
    @Body() dto: SyncEventsDto,
    @Req() req: Request,
  ) {
    return this.attendance.syncEvents(device, dto, req.ip);
  }
}

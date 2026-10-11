import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { AlertNotesDto } from './dto/alert-notes.dto';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
import { AlertsService } from './alerts.service';

@ApiTags('هشدارها')
@ApiBearerAuth()
@Controller('alerts')
@UseGuards(PermissionsGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ALERTS_READ)
  @ApiOperation({ summary: 'فهرست هشدارها' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListAlertsQueryDto) {
    return this.alerts.list(user, query);
  }

  @Post(':id/acknowledge')
  @RequirePermissions(PERMISSIONS.ALERTS_READ)
  @ApiOperation({ summary: 'تأیید مشاهده هشدار' })
  acknowledge(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AlertNotesDto,
  ) {
    return this.alerts.acknowledge(user, id, dto);
  }

  @Post(':id/resolve')
  @RequirePermissions(PERMISSIONS.ALERTS_READ)
  @ApiOperation({ summary: 'بستن / حل هشدار' })
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AlertNotesDto,
  ) {
    return this.alerts.resolve(user, id, dto);
  }
}

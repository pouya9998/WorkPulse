import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { ActivityReportQueryDto } from './dto/activity-report-query.dto';
import { ConfigureConnectionDto } from './dto/configure-connection.dto';
import { ConnectProjectsDto } from './dto/connect-projects.dto';
import { CreateUserMappingDto, UpdateUserMappingDto } from './dto/user-mapping.dto';
import { GitLabService } from './gitlab.service';

@ApiTags('GitLab')
@Controller('gitlab')
@UseGuards(PermissionsGuard)
export class GitLabController {
  constructor(private readonly gitlab: GitLabService) {}

  @Get('connection')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'وضعیت اتصال GitLab' })
  getConnection(@CurrentUser() user: AuthUser) {
    return this.gitlab.getConnection(user);
  }

  @Post('connection')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'پیکربندی اتصال GitLab' })
  configure(@CurrentUser() user: AuthUser, @Body() dto: ConfigureConnectionDto) {
    return this.gitlab.configureConnection(user, dto);
  }

  @Get('projects')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  listProjects(@CurrentUser() user: AuthUser) {
    return this.gitlab.listProjects(user);
  }

  @Post('projects/connect')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  connectProjects(@CurrentUser() user: AuthUser, @Body() dto: ConnectProjectsDto) {
    return this.gitlab.connectProjects(user, dto);
  }

  @Post('sync')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  sync(@CurrentUser() user: AuthUser) {
    return this.gitlab.triggerSync(user);
  }

  @Get('mappings')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  listMappings(@CurrentUser() user: AuthUser) {
    return this.gitlab.listMappings(user);
  }

  @Post('mappings')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  createMapping(@CurrentUser() user: AuthUser, @Body() dto: CreateUserMappingDto) {
    return this.gitlab.createMapping(user, dto);
  }

  @Put('mappings/:id')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  updateMapping(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserMappingDto,
  ) {
    return this.gitlab.updateMapping(user, id, dto);
  }

  @Delete('mappings/:id')
  @RequirePermissions(PERMISSIONS.GITLAB_MANAGE)
  @ApiBearerAuth()
  deleteMapping(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.gitlab.deleteMapping(user, id);
  }

  @Get('engineering/activity')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'گزارش فعالیت مهندسی' })
  activityReport(@CurrentUser() user: AuthUser, @Query() query: ActivityReportQueryDto) {
    return this.gitlab.engineeringActivityReport(user, query);
  }

  @Public()
  @Post('webhooks')
  @ApiOperation({ summary: 'Webhook GitLab' })
  webhook(
    @Req() req: Request,
    @Headers('x-gitlab-token') token: string | undefined,
    @Headers('x-gitlab-event') eventType: string | undefined,
    @Headers('x-gitlab-event-uuid') eventUuid: string | undefined,
    @Headers('x-gitlab-delivery') deliveryId: string | undefined,
    @Query('organizationId') organizationId: string | undefined,
  ) {
    this.gitlab.validateWebhookSecret(token);
    const body = req.body as Record<string, unknown>;
    const id =
      deliveryId ||
      eventUuid ||
      String(body?.object_kind || 'evt') + '-' + String(body?.event_id || Date.now());
    return this.gitlab.handleWebhook(
      organizationId || String(body?.organization_id || ''),
      id,
      eventType || String(body?.object_kind || 'unknown'),
      body,
    );
  }
}

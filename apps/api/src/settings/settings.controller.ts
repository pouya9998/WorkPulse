import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { AuditService } from '../audit/audit.service';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('تنظیمات')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(PermissionsGuard)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get('organization')
  @RequirePermissions(PERMISSIONS.ORG_SETTINGS)
  @ApiOperation({ summary: 'تنظیمات سازمان و امنیت' })
  get(@CurrentUser() user: AuthUser) {
    return this.settings.getOrgSettings(user);
  }

  @Patch('organization')
  @RequirePermissions(PERMISSIONS.ORG_SETTINGS)
  @ApiOperation({ summary: 'ویرایش تنظیمات سازمان' })
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrgSettingsDto) {
    const updated = await this.settings.updateOrgSettings(user, dto);
    await this.audit.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'org.settings_updated',
      entityType: 'Organization',
      entityId: user.organizationId,
      metadata: { fields: Object.keys(dto) },
    });
    return updated;
  }
}

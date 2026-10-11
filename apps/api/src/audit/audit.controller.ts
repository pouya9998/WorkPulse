import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { AuthUser } from '../auth/auth.types';
import { AuditService } from './audit.service';

@ApiTags('حسابرسی')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'فهرست رویدادهای حسابرسی سازمان' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.audit.list(
      user.organizationId,
      take ? Number(take) : 50,
      skip ? Number(skip) : 0,
    );
  }
}

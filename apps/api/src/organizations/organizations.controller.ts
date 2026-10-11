import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { OrganizationsService } from './organizations.service';

@ApiTags('سازمان')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'اطلاعات سازمان جاری' })
  me(@CurrentUser() user: AuthUser) {
    return this.organizations.getMine(user.organizationId);
  }
}

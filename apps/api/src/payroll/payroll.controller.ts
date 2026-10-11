import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PERMISSIONS } from '../common/permissions';
import { CreateContractDto, NewContractVersionDto } from './dto/contract.dto';
import { CreatePayrollPeriodDto, GenerateProposalsBodyDto } from './dto/payroll-period.dto';
import { ReviewProposalDto } from './dto/proposal-review.dto';
import { PayrollService } from './payroll.service';

@ApiTags('حقوق و قرارداد')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('contracts')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  @ApiOperation({ summary: 'فهرست قراردادها' })
  listContracts(@CurrentUser() user: AuthUser) {
    return this.payroll.listContracts(user);
  }

  @Get('contracts/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  getContract(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payroll.getContract(user, id);
  }

  @Post('contracts')
  @RequirePermissions(PERMISSIONS.PAYROLL_REVIEW)
  createContract(@CurrentUser() user: AuthUser, @Body() dto: CreateContractDto) {
    return this.payroll.createContract(user, dto);
  }

  @Post('contracts/:id/versions')
  @RequirePermissions(PERMISSIONS.PAYROLL_REVIEW)
  newVersion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: NewContractVersionDto,
  ) {
    return this.payroll.addContractVersion(user, id, dto);
  }

  @Get('payroll/periods')
  @RequirePermissions(PERMISSIONS.PAYROLL_READ)
  listPeriods(@CurrentUser() user: AuthUser) {
    return this.payroll.listPeriods(user);
  }

  @Post('payroll/periods')
  @RequirePermissions(PERMISSIONS.PAYROLL_REVIEW)
  createPeriod(@CurrentUser() user: AuthUser, @Body() dto: CreatePayrollPeriodDto) {
    return this.payroll.createPeriod(user, dto);
  }

  @Get('payroll/proposals')
  @ApiOperation({ summary: 'پیشنهادهای حقوق — بازبین همه، کارمند فقط خود' })
  listProposals(@CurrentUser() user: AuthUser, @Query('periodId') periodId?: string) {
    return this.payroll.listProposals(user, periodId);
  }

  @Get('payroll/proposals/:id')
  getProposal(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payroll.getProposal(user, id);
  }

  @Post('payroll/periods/:periodId/generate')
  @RequirePermissions(PERMISSIONS.PAYROLL_REVIEW)
  generate(
    @CurrentUser() user: AuthUser,
    @Param('periodId') periodId: string,
    @Body() body: GenerateProposalsBodyDto,
  ) {
    return this.payroll.generateProposals(user, periodId, body);
  }

  @Post('payroll/proposals/:id/review')
  @RequirePermissions(PERMISSIONS.PAYROLL_REVIEW)
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewProposalDto,
  ) {
    return this.payroll.reviewProposal(user, id, dto);
  }
}

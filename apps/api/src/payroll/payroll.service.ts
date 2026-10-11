import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { PERMISSIONS } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto, NewContractVersionDto } from './dto/contract.dto';
import { CreatePayrollPeriodDto, GenerateProposalsBodyDto } from './dto/payroll-period.dto';
import { ReviewProposalDto } from './dto/proposal-review.dto';
import {
  assertContractRates,
  calculateFixedProposal,
  calculateHourlyProposal,
} from './payroll-calc.util';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async listContracts(user: AuthUser) {
    this.requirePayrollRead(user);
    return this.prisma.contract.findMany({
      where: { organizationId: user.organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getContract(user: AuthUser, id: string) {
    this.requirePayrollRead(user);
    const contract = await this.prisma.contract.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });
    if (!contract) throw new NotFoundException('قرارداد یافت نشد');
    return contract;
  }

  async createContract(user: AuthUser, dto: CreateContractDto) {
    this.requirePayrollReview(user);
    await this.assertOrgUser(user.organizationId, dto.userId);

    const hourlyRate = dto.hourlyRate ? new Prisma.Decimal(dto.hourlyRate) : null;
    const baseMonthly = dto.baseMonthly ? new Prisma.Decimal(dto.baseMonthly) : null;
    try {
      assertContractRates(dto.contractType, hourlyRate, baseMonthly);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'قرارداد نامعتبر');
    }

    const contract = await this.prisma.contract.create({
      data: {
        organizationId: user.organizationId,
        userId: dto.userId,
        contractType: dto.contractType,
        currency: dto.currency || 'IRR',
        versions: {
          create: {
            versionNumber: 1,
            contractType: dto.contractType,
            hourlyRate,
            baseMonthly,
            effectiveFrom: new Date(dto.effectiveFrom),
            noteFa: dto.noteFa,
            createdById: user.id,
          },
        },
      },
      include: { versions: true },
    });
    return contract;
  }

  async addContractVersion(user: AuthUser, contractId: string, dto: NewContractVersionDto) {
    this.requirePayrollReview(user);
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, organizationId: user.organizationId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!contract) throw new NotFoundException('قرارداد یافت نشد');

    const latest = contract.versions[0];
    const hourlyRate = dto.hourlyRate
      ? new Prisma.Decimal(dto.hourlyRate)
      : latest?.hourlyRate ?? null;
    const baseMonthly = dto.baseMonthly
      ? new Prisma.Decimal(dto.baseMonthly)
      : latest?.baseMonthly ?? null;
    assertContractRates(contract.contractType, hourlyRate, baseMonthly);

    const nextVersion = (latest?.versionNumber ?? 0) + 1;
    const version = await this.prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        versionNumber: nextVersion,
        contractType: contract.contractType,
        hourlyRate,
        baseMonthly,
        effectiveFrom: new Date(dto.effectiveFrom),
        noteFa: dto.noteFa,
        createdById: user.id,
      },
    });
    await this.prisma.contract.update({
      where: { id: contract.id },
      data: { contractType: contract.contractType },
    });
    return version;
  }

  async listPeriods(user: AuthUser) {
    this.requirePayrollRead(user);
    return this.prisma.payrollPeriod.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { periodStart: 'desc' },
    });
  }

  async createPeriod(user: AuthUser, dto: CreatePayrollPeriodDto) {
    this.requirePayrollReview(user);
    return this.prisma.payrollPeriod.create({
      data: {
        organizationId: user.organizationId,
        labelFa: dto.labelFa,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
      },
    });
  }

  async listProposals(user: AuthUser, periodId?: string) {
    const canReadAll = user.permissions.includes(PERMISSIONS.PAYROLL_READ);
    if (!canReadAll) {
      return this.prisma.compensationProposal.findMany({
        where: { organizationId: user.organizationId, userId: user.id },
        include: { payrollPeriod: true, adjustments: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.compensationProposal.findMany({
      where: {
        organizationId: user.organizationId,
        ...(periodId ? { payrollPeriodId: periodId } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        payrollPeriod: true,
        adjustments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProposal(user: AuthUser, id: string) {
    const proposal = await this.prisma.compensationProposal.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        payrollPeriod: true,
        adjustments: true,
      },
    });
    if (!proposal) throw new NotFoundException('پیشنهاد حقوق یافت نشد');
    if (
      proposal.userId !== user.id &&
      !user.permissions.includes(PERMISSIONS.PAYROLL_READ)
    ) {
      throw new ForbiddenException('دسترسی به این پیشنهاد مجاز نیست');
    }
    return this.formatProposalResponse(proposal);
  }

  async generateProposals(user: AuthUser, periodId: string, body: GenerateProposalsBodyDto) {
    this.requirePayrollReview(user);
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, organizationId: user.organizationId },
    });
    if (!period) throw new NotFoundException('دوره حقوق یافت نشد');
    if (period.status === 'CLOSED') {
      throw new BadRequestException('دوره بسته است');
    }

    const contracts = await this.prisma.contract.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(body.userIds?.length ? { userId: { in: body.userIds } } : {}),
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });

    const created = [];
    for (const contract of contracts) {
      const version = this.pickVersionForPeriod(contract.versions, period.periodStart);
      if (!version) continue;

      const existing = await this.prisma.compensationProposal.findUnique({
        where: {
          payrollPeriodId_userId: {
            payrollPeriodId: periodId,
            userId: contract.userId,
          },
        },
        include: { adjustments: true },
      });
      if (existing && existing.status !== 'DRAFT') {
        continue;
      }

      const adjustments = existing?.adjustments ?? [];
      const calc = await this.computeProposal(
        contract.userId,
        user.organizationId,
        contract.contractType,
        version,
        period.periodStart,
        period.periodEnd,
        adjustments,
      );

      const row = await this.prisma.compensationProposal.upsert({
        where: {
          payrollPeriodId_userId: {
            payrollPeriodId: periodId,
            userId: contract.userId,
          },
        },
        create: {
          organizationId: user.organizationId,
          payrollPeriodId: periodId,
          userId: contract.userId,
          contractVersionId: version.id,
          status: 'PENDING_REVIEW',
          proposedAmount: calc.total,
          approvedPayableHours: calc.payableHours,
          formulaBreakdown: calc.breakdown,
        },
        update: {
          contractVersionId: version.id,
          proposedAmount: calc.total,
          approvedPayableHours: calc.payableHours,
          formulaBreakdown: calc.breakdown,
          status: 'PENDING_REVIEW',
        },
        include: { adjustments: true },
      });
      created.push(row);
    }
    return { generated: created.length, proposals: created.map((p) => this.formatProposalResponse(p)) };
  }

  async reviewProposal(user: AuthUser, id: string, dto: ReviewProposalDto) {
    this.requirePayrollReview(user);
    const proposal = await this.prisma.compensationProposal.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!proposal) throw new NotFoundException('پیشنهاد یافت نشد');
    if (proposal.status === 'APPROVED' || proposal.status === 'REJECTED') {
      throw new BadRequestException('این پیشنهاد قبلاً بررسی شده');
    }
    return this.prisma.compensationProposal.update({
      where: { id },
      data: {
        status: dto.decision,
        reviewerNotes: dto.reviewerNotes,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
  }

  private async computeProposal(
    userId: string,
    organizationId: string,
    contractType: ContractType,
    version: {
      id: string;
      hourlyRate: Prisma.Decimal | null;
      baseMonthly: Prisma.Decimal | null;
    },
    periodStart: Date,
    periodEnd: Date,
    adjustments: { amount: Prisma.Decimal; isDeduction: boolean }[],
  ) {
    if (contractType === 'HOURLY') {
      const payableHours = await this.computePayableHours(userId, periodStart, periodEnd);
      const rate = version.hourlyRate ?? new Prisma.Decimal(0);
      const { total, breakdown } = calculateHourlyProposal(payableHours, rate, adjustments);
      return { total, breakdown, payableHours };
    }

    const flags = await this.collectAttendanceFlags(userId, periodStart, periodEnd);
    const base = version.baseMonthly ?? new Prisma.Decimal(0);
    const { total, breakdown } = calculateFixedProposal(base, adjustments, flags);
    return { total, breakdown, payableHours: null };
  }

  private async computePayableHours(userId: string, from: Date, to: Date) {
    const sessions = await this.prisma.workSession.findMany({
      where: {
        userId,
        startedAt: { lte: to },
        OR: [{ endedAt: null }, { endedAt: { gte: from } }],
      },
    });
    let ms = 0;
    for (const s of sessions) {
      const start = s.startedAt < from ? from : s.startedAt;
      const end = s.endedAt ? (s.endedAt > to ? to : s.endedAt) : to;
      if (end > start) ms += end.getTime() - start.getTime();
    }
    const hours = new Prisma.Decimal(ms).div(3600000);
    return hours.toDecimalPlaces(4);
  }

  private async collectAttendanceFlags(userId: string, from: Date, to: Date) {
    const flags: string[] = [];
    const hb = await this.prisma.heartbeatEvent.count({
      where: { userId, receivedAtServer: { gte: from, lte: to } },
    });
    if (hb === 0) {
      flags.push('heartbeat در این دوره ثبت نشده (کسر خودکار اعمال نمی‌شود)');
    }
    const idleSessions = await this.prisma.deviceStateInterval.count({
      where: {
        userId,
        state: 'IDLE',
        startedAt: { gte: from, lte: to },
      },
    });
    if (idleSessions > 5) {
      flags.push('مدت idle بالا — فقط برای بازبین');
    }
    return flags;
  }

  private pickVersionForPeriod(
    versions: {
      id: string;
      versionNumber: number;
      effectiveFrom: Date;
      hourlyRate: Prisma.Decimal | null;
      baseMonthly: Prisma.Decimal | null;
    }[],
    periodStart: Date,
  ) {
    const eligible = versions
      .filter((v) => v.effectiveFrom <= periodStart)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return eligible[0] ?? versions[0];
  }

  private formatProposalResponse(
    proposal: {
      id: string;
      proposedAmount: Prisma.Decimal;
      approvedPayableHours: Prisma.Decimal | null;
      formulaBreakdown: unknown;
      status: string;
      reviewerNotes: string | null;
      adjustments: { labelFa: string; amount: Prisma.Decimal; isDeduction: boolean }[];
      user?: { firstName: string; lastName: string; email: string };
      payrollPeriod?: { labelFa: string; periodStart: Date; periodEnd: Date };
    },
  ) {
    return {
      ...proposal,
      proposedAmount: proposal.proposedAmount.toFixed(2),
      approvedPayableHours: proposal.approvedPayableHours?.toFixed(4) ?? null,
      formulaBreakdownFa: proposal.formulaBreakdown,
      adjustments: proposal.adjustments.map((a) => ({
        ...a,
        amount: a.amount.toFixed(2),
      })),
    };
  }

  private requirePayrollRead(user: AuthUser) {
    if (!user.permissions.includes(PERMISSIONS.PAYROLL_READ)) {
      throw new ForbiddenException('مجوز payroll:read لازم است');
    }
  }

  private requirePayrollReview(user: AuthUser) {
    if (!user.permissions.includes(PERMISSIONS.PAYROLL_REVIEW)) {
      throw new ForbiddenException('مجوز payroll:review لازم است');
    }
  }

  private async assertOrgUser(organizationId: string, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!u) throw new BadRequestException('کاربر در سازمان نیست');
  }
}

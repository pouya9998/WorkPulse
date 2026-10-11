import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, RoleCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  calculateFixedProposal,
  calculateHourlyProposal,
} from '../src/payroll/payroll-calc.util';

describe('WorkPulse Phase 6 Payroll (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId = '';
  let reviewerToken = '';
  let hourlyUserId = '';
  let fixedUserId = '';
  let periodId = '';
  const password = 'PayrollPass123!';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL برای تست e2e الزامی است');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.compensationAdjustment.deleteMany({});
    await prisma.compensationProposal.deleteMany({});
    await prisma.payrollPeriod.deleteMany({});
    await prisma.contractVersion.deleteMany({});
    await prisma.contract.deleteMany({});

    const reviewerRole = await prisma.role.findFirst({
      where: { code: RoleCode.PAYROLL_REVIEWER, organizationId: null },
    });
    if (!reviewerRole) throw new Error('role missing');

    const org = await prisma.organization.create({
      data: { name: 'Payroll Org', slug: `payroll-org-${Date.now()}` },
    });
    orgId = org.id;

    const passwordHash = await bcrypt.hash(password, 10);
    const reviewerEmail = `pay-reviewer-${Date.now()}@test.local`;
    await prisma.user.create({
      data: {
        organizationId: org.id,
        email: reviewerEmail,
        username: `pay_rev_${Date.now()}`,
        passwordHash,
        firstName: 'بازبین',
        lastName: 'حقوق',
        status: 'ACTIVE',
        roles: { create: [{ roleId: reviewerRole.id }] },
      },
    });

    const hourly = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `hourly-${Date.now()}@test.local`,
        username: `hourly_${Date.now()}`,
        passwordHash,
        firstName: 'ساعتی',
        lastName: 'کار',
        contractType: 'HOURLY',
        status: 'ACTIVE',
      },
    });
    hourlyUserId = hourly.id;

    const fixed = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `fixed-${Date.now()}@test.local`,
        username: `fixed_${Date.now()}`,
        passwordHash,
        firstName: 'تمام',
        lastName: 'وقت',
        contractType: 'FULL_TIME_REMOTE',
        status: 'ACTIVE',
      },
    });
    fixedUserId = fixed.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: reviewerEmail, password })
      .expect(201);
    reviewerToken = login.body.accessToken;
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('محاسبه ساعتی با دقت Decimal', () => {
    const hours = new Prisma.Decimal('10.2500');
    const rate = new Prisma.Decimal('150000.0000');
    const { total } = calculateHourlyProposal(hours, rate, []);
    expect(total.toFixed(2)).toBe('1537500.00');
  });

  it('محاسبه ثابت بدون کسر heartbeat', () => {
    const base = new Prisma.Decimal('50000000.00');
    const { total, breakdown } = calculateFixedProposal(base, [], ['heartbeat missing']);
    expect(total.toFixed(2)).toBe('50000000.00');
    expect(breakdown.some((l) => l.value.includes('کسر خودکار'))).toBe(true);
  });

  it('نسخه‌گذاری قرارداد و تولید/تأیید پیشنهاد', async () => {
    const hourlyContract = await request(app.getHttpServer())
      .post('/api/contracts')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        userId: hourlyUserId,
        contractType: 'HOURLY',
        hourlyRate: '100000.0000',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/contracts/${hourlyContract.body.id}/versions`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        hourlyRate: '120000.0000',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        noteFa: 'افزایش نرخ',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/contracts')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        userId: fixedUserId,
        contractType: 'FULL_TIME_REMOTE',
        baseMonthly: '45000000.00',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
      })
      .expect(201);

    const period = await request(app.getHttpServer())
      .post('/api/payroll/periods')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        labelFa: 'مهر ۱۴۰۵',
        periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: '2026-10-31T23:59:59.999Z',
      })
      .expect(201);
    periodId = period.body.id;

    await prisma.workSession.create({
      data: {
        organizationId: orgId,
        userId: hourlyUserId,
        status: 'CLOSED',
        startedAt: new Date('2026-10-05T08:00:00Z'),
        endedAt: new Date('2026-10-05T16:00:00Z'),
      },
    });

    const gen = await request(app.getHttpServer())
      .post(`/api/payroll/periods/${periodId}/generate`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({})
      .expect(201);
    expect(gen.body.generated).toBeGreaterThanOrEqual(2);

    const proposalRow = await prisma.compensationProposal.findFirst({
      where: { payrollPeriodId: periodId, userId: hourlyUserId },
    });
    const proposalId = proposalRow?.id;
    expect(proposalId).toBeDefined();

    const detail = await request(app.getHttpServer())
      .get(`/api/payroll/proposals/${proposalId}`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);
    expect(detail.body.formulaBreakdownFa).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/payroll/proposals/${proposalId}/review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'APPROVED', reviewerNotes: 'تأیید تست' })
      .expect(201);

    const after = await prisma.compensationProposal.findUnique({ where: { id: proposalId! } });
    expect(after?.status).toBe('APPROVED');
  });
});

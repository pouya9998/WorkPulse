import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlertType, RoleCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AlertsEngineService } from '../src/alerts/alerts-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WorkPulse Phase 3 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let engine: AlertsEngineService;

  const password = 'Phase3Pass123!';
  let orgId = '';
  let adminToken = '';
  let employeeToken = '';
  let employeeId = '';
  let correctionId = '';

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
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    engine = app.get(AlertsEngineService);

    const adminRole = await prisma.role.findFirst({
      where: { code: RoleCode.ORGANIZATION_ADMIN, organizationId: null },
    });
    const empRole = await prisma.role.findFirst({
      where: { code: RoleCode.EMPLOYEE, organizationId: null },
    });
    if (!adminRole || !empRole) throw new Error('نقش‌ها یافت نشدند');

    const org = await prisma.organization.create({
      data: { name: 'فاز۳', slug: `phase3-${Date.now()}` },
    });
    orgId = org.id;

    await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `p3-admin-${Date.now()}@test.local`,
        username: `p3_admin_${Date.now()}`,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'مدیر',
        lastName: 'فاز۳',
        roles: { create: [{ roleId: adminRole.id }] },
      },
    });

    const employee = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `p3-emp-${Date.now()}@test.local`,
        username: `p3_emp_${Date.now()}`,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'کارمند',
        lastName: 'فاز۳',
        roles: { create: [{ roleId: empRole.id }] },
      },
    });
    employeeId = employee.id;

    await prisma.bootstrapState.create({
      data: { organizationId: org.id, completedAt: new Date() },
    });
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('ورود مدیر و کارمند', async () => {
    const adminLogin = await prisma.user.findFirst({
      where: { organizationId: orgId, roles: { some: { role: { code: RoleCode.ORGANIZATION_ADMIN } } } },
    });
    const empLogin = await prisma.user.findFirst({ where: { id: employeeId } });

    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminLogin!.email, password })
      .expect(201);
    adminToken = adminRes.body.accessToken;

    const empRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: empLogin!.email, password })
      .expect(201);
    employeeToken = empRes.body.accessToken;
  });

  it('کارمند می‌تواند درخواست اصلاح ثبت کند', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/attendance-corrections')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reasonFa: 'فراموشی پایان کار' })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    correctionId = res.body.id;
  });

  it('مدیر درخواست اصلاح را تأیید می‌کند', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/attendance-corrections/${correctionId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewNotesFa: 'تأیید شد' })
      .expect(201);

    expect(res.body.status).toBe('APPROVED');
  });

  it('dedupe هشدار: دوباره ایجاد نمی‌شود', async () => {
    const windowStart = new Date('2026-10-11T00:00:00.000Z');
    const windowEnd = new Date('2026-10-12T00:00:00.000Z');

    const first = await engine.createAlertDeduped({
      organizationId: orgId,
      userId: employeeId,
      type: AlertType.UNRESOLVED_TIME,
      titleFa: 'زمان حل‌نشده',
      messageFa: 'تست dedupe',
      windowStart,
      windowEnd,
    });
    expect(first.created).toBe(true);

    const second = await engine.createAlertDeduped({
      organizationId: orgId,
      userId: employeeId,
      type: AlertType.UNRESOLVED_TIME,
      titleFa: 'زمان حل‌نشده',
      messageFa: 'تست dedupe',
      windowStart,
      windowEnd,
    });
    expect(second.created).toBe(false);
  });

  it('کارمند بدون مجوز نمی‌تواند سیاست حضور ایجاد کند', async () => {
    await request(app.getHttpServer())
      .post('/api/attendance-policies')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        nameFa: 'سیاست غیرمجاز',
        expectedWorkStartUtc: '06:00',
        expectedWorkEndUtc: '14:00',
      })
      .expect(403);
  });
});

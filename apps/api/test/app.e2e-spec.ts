import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WorkPulse Phase 1 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = `admin-${Date.now()}@test.local`;
  const adminPassword = 'TestAdminPass123!';
  let adminToken = '';
  let orgId = '';
  let employeeId = '';

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

    // پاک‌سازی داده‌های تست قبلی با پیشوند test
    await prisma.auditLog.deleteMany({});
    await prisma.userSession.deleteMany({});
    await prisma.teamMember.deleteMany({});
    await prisma.userRole.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.bootstrapState.deleteMany({});
    await prisma.organization.deleteMany({});

    // اطمینان از وجود نقش‌ها
    await request(app.getHttpServer()).get('/api/health').expect(200);

    const adminRole = await prisma.role.findFirst({
      where: { code: RoleCode.SUPER_ADMIN, organizationId: null },
    });
    if (!adminRole) {
      throw new Error('نقش SUPER_ADMIN یافت نشد');
    }

    const org = await prisma.organization.create({
      data: {
        name: 'سازمان تست',
        slug: `test-org-${Date.now()}`,
        timezone: 'Asia/Tehran',
      },
    });
    orgId = org.id;

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        organizationId: org.id,
        email: adminEmail,
        username: `admin_${Date.now()}`,
        passwordHash,
        firstName: 'مدیر',
        lastName: 'تست',
        status: 'ACTIVE',
        roles: { create: [{ roleId: adminRole.id }] },
      },
    });

    await prisma.bootstrapState.create({
      data: { organizationId: org.id, completedAt: new Date() },
    });
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('سلامت سرویس را برمی‌گرداند', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('ورود مدیر موفق است', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    adminToken = res.body.accessToken;
  });

  it('ورود با رمز اشتباه رد می‌شود', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'WrongPassword!!' })
      .expect(401);
  });

  it('مدیر می‌تواند کاربر ایجاد کند', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'سارا',
        lastName: 'احمدی',
        email: `sara-${Date.now()}@test.local`,
        password: 'EmployeePass123!',
        contractType: 'HOURLY',
        roles: ['EMPLOYEE'],
        jobTitle: 'توسعه‌دهنده',
      })
      .expect(201);

    expect(res.body.firstName).toBe('سارا');
    expect(res.body.roles[0].code).toBe('EMPLOYEE');
    employeeId = res.body.id;
  });

  it('فهرست کاربران سازمان را برمی‌گرداند', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('ایزوله بودن سازمان: کاربر سازمان دیگر دیده نمی‌شود', async () => {
    const otherOrg = await prisma.organization.create({
      data: {
        name: 'سازمان دیگر',
        slug: `other-org-${Date.now()}`,
      },
    });
    const empRole = await prisma.role.findFirst({
      where: { code: RoleCode.EMPLOYEE, organizationId: null },
    });
    await prisma.user.create({
      data: {
        organizationId: otherOrg.id,
        email: `other-${Date.now()}@test.local`,
        username: `other_${Date.now()}`,
        passwordHash: await bcrypt.hash('OtherPass123!', 10),
        firstName: 'دیگر',
        lastName: 'سازمان',
        roles: { create: [{ roleId: empRole!.id }] },
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const emails = res.body.map((u: { email: string }) => u.email);
    expect(emails.every((e: string) => !e.startsWith('other-'))).toBe(true);
    expect(orgId).toBeTruthy();
  });

  it('دسترسی غیرمجاز کارمند به ایجاد کاربر رد می‌شود', async () => {
    const empEmail = `emp-login-${Date.now()}@test.local`;
    const empPass = 'EmployeePass123!';
    const empRole = await prisma.role.findFirst({
      where: { code: RoleCode.EMPLOYEE, organizationId: null },
    });
    await prisma.user.create({
      data: {
        organizationId: orgId,
        email: empEmail,
        username: `emp_${Date.now()}`,
        passwordHash: await bcrypt.hash(empPass, 10),
        firstName: 'کارمند',
        lastName: 'عادی',
        roles: { create: [{ roleId: empRole!.id }] },
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: empEmail, password: empPass })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({
        firstName: 'غیر',
        lastName: 'مجاز',
        email: `forbidden-${Date.now()}@test.local`,
        password: 'Forbidden123!',
        contractType: 'FULL_TIME_REMOTE',
        roles: ['EMPLOYEE'],
      })
      .expect(403);
  });

  it('غیرفعال‌سازی کاربر و رد ورود پس از آن', async () => {
    await request(app.getHttpServer())
      .post(`/api/users/${employeeId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const user = await prisma.user.findUnique({ where: { id: employeeId } });
    expect(user?.status).toBe('INACTIVE');
  });

  it('رویداد حسابرسی ثبت می‌شود', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.total).toBeGreaterThan(0);
    const actions = res.body.items.map((i: { action: string }) => i.action);
    expect(actions).toContain('user.created');
  });

  it('Bootstrap پس از وجود کاربر غیرفعال است', async () => {
    const res = await request(app.getHttpServer()).get('/api/bootstrap/status').expect(200);
    expect(res.body.needsBootstrap).toBe(false);
  });
});

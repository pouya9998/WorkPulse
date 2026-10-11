import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('WorkPulse Phase 2 Attendance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = `agent-user-${Date.now()}@test.local`;
  const password = 'AgentUserPass123!';
  let orgId = '';
  let userId = '';
  let deviceToken = '';
  let deviceId = '';
  let adminToken = '';

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

    const empRole = await prisma.role.findFirst({
      where: { code: RoleCode.EMPLOYEE, organizationId: null },
    });
    const adminRole = await prisma.role.findFirst({
      where: { code: RoleCode.SUPER_ADMIN, organizationId: null },
    });
    if (!empRole || !adminRole) throw new Error('نقش‌ها یافت نشدند');

    const org = await prisma.organization.create({
      data: {
        name: 'سازمان Agent',
        slug: `agent-org-${Date.now()}`,
      },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        username: `agent_${Date.now()}`,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'ایجنت',
        lastName: 'تست',
        roles: { create: [{ roleId: empRole.id }] },
      },
    });
    userId = user.id;

    const admin = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `admin-agent-${Date.now()}@test.local`,
        username: `admin_agent_${Date.now()}`,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'مدیر',
        lastName: 'ایجنت',
        roles: { create: [{ roleId: adminRole.id }] },
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: admin.email, password })
      .expect(201);
    adminToken = login.body.accessToken;
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('ثبت دستگاه Agent موفق است', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/agent/register')
      .send({
        email,
        password,
        deviceUid: `uid-${Date.now()}-abcdef12`,
        name: 'لپ‌تاپ تست',
        platform: 'linux',
        osVersion: 'test',
        agentVersion: '0.2.0',
      })
      .expect(201);

    expect(res.body.deviceToken).toBeDefined();
    expect(res.body.deviceId).toBeDefined();
    deviceToken = res.body.deviceToken;
    deviceId = res.body.deviceId;
  });

  it('شروع کار ثبت می‌شود', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/agent/work/start')
      .set('X-Device-Token', deviceToken)
      .send({
        clientEventId: `wstart-${Date.now()}-aaaa`,
        occurredAtDevice: new Date().toISOString(),
      })
      .expect(201);

    expect(res.body.workSessionId).toBeTruthy();
    expect(res.body.duplicate).toBe(false);
  });

  it('رویداد تکراری شروع کار duplicate می‌شود', async () => {
    const clientEventId = `wstart-dup-${Date.now()}-bbbb`;
    const payload = {
      clientEventId,
      occurredAtDevice: new Date().toISOString(),
    };

    await request(app.getHttpServer())
      .post('/api/agent/work/start')
      .set('X-Device-Token', deviceToken)
      .send(payload)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/agent/work/start')
      .set('X-Device-Token', deviceToken)
      .send(payload)
      .expect(201);

    expect(res.body.duplicate).toBe(true);
  });

  it('Heartbeat ثبت می‌شود و تکراری رد منطقی می‌شود', async () => {
    const clientEventId = `hb-${Date.now()}-cccc`;
    const payload = {
      clientEventId,
      sentAtDevice: new Date().toISOString(),
      idleSeconds: 10,
      isLocked: false,
      agentVersion: '0.2.0',
    };

    const first = await request(app.getHttpServer())
      .post('/api/agent/heartbeat')
      .set('X-Device-Token', deviceToken)
      .send(payload)
      .expect(201);
    expect(first.body.duplicate).toBe(false);

    const second = await request(app.getHttpServer())
      .post('/api/agent/heartbeat')
      .set('X-Device-Token', deviceToken)
      .send(payload)
      .expect(201);
    expect(second.body.duplicate).toBe(true);
  });

  it('همگام‌سازی آفلاین رویداد Idle را می‌پذیرد', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/agent/events/sync')
      .set('X-Device-Token', deviceToken)
      .send({
        events: [
          {
            clientEventId: `idle-${Date.now()}-dddd`,
            type: 'IDLE_START',
            occurredAtDevice: past,
            sequence: 1,
          },
          {
            clientEventId: `idle-${Date.now()}-eeee`,
            type: 'IDLE_END',
            occurredAtDevice: new Date().toISOString(),
            sequence: 2,
          },
        ],
      })
      .expect(201);

    expect(res.body.accepted).toBe(2);
  });

  it('رویداد خارج از ترتیب با پرچم outOfOrder ذخیره می‌شود', async () => {
    const older = new Date(Date.now() - 120_000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/agent/events/sync')
      .set('X-Device-Token', deviceToken)
      .send({
        events: [
          {
            clientEventId: `ooo-${Date.now()}-ffff`,
            type: 'SCREEN_LOCK',
            occurredAtDevice: older,
            sequence: 99,
          },
        ],
      })
      .expect(201);

    expect(res.body.accepted).toBe(1);
    const ev = await prisma.attendanceEvent.findFirst({
      where: { deviceId, type: 'SCREEN_LOCK' },
      orderBy: { createdAt: 'desc' },
    });
    expect(ev?.outOfOrder).toBe(true);
  });

  it('وضعیت حضور برای کاربر قابل خواندن است', async () => {
    // ورود خود کاربر
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/attendance/status')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(res.body.displayStatus).toBeDefined();
    expect(res.body.agent).toBeTruthy();
    expect(userId).toBeTruthy();
  });

  it('مدیر می‌تواند دستگاه را لغو کند و درخواست بعدی رد شود', async () => {
    await request(app.getHttpServer())
      .post(`/api/devices/${deviceId}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/agent/heartbeat')
      .set('X-Device-Token', deviceToken)
      .send({
        clientEventId: `hb-revoked-${Date.now()}`,
        sentAtDevice: new Date().toISOString(),
      })
      .expect(401);

    expect(orgId).toBeTruthy();
  });
});

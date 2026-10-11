import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleCode } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GITLAB_API_CLIENT, GitLabApiClient } from '../src/gitlab/gitlab-api.types';
import { PrismaService } from '../src/prisma/prisma.service';

const mockGitLabClient: GitLabApiClient = {
  listProjects: jest.fn(async (_base, _token, page) => {
    if (page > 1) return [];
    return [{ id: 99, path_with_namespace: 'org/demo', name: 'demo' }];
  }),
};

describe('WorkPulse Phase 5 GitLab (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId = '';
  let adminToken = '';
  let adminEmail = '';
  let employeeId = '';
  let projectDbId = '';
  const webhookSecret = 'test-webhook-secret-phase5';
  const adminPassword = 'AdminPass123!';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL برای تست e2e الزامی است');
    }
    process.env.GITLAB_WEBHOOK_SECRET = webhookSecret;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-min-32-characters-long!!';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GITLAB_API_CLIENT)
      .useValue(mockGitLabClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.review.deleteMany({});
    await prisma.mergeRequest.deleteMany({});
    await prisma.pipeline.deleteMany({});
    await prisma.engineeringMetric.deleteMany({});
    await prisma.gitLabWebhookEvent.deleteMany({});
    await prisma.gitLabUserMapping.deleteMany({});
    await prisma.gitLabProject.deleteMany({});
    await prisma.gitLabConnection.deleteMany({});

    const adminRole = await prisma.role.findFirst({
      where: { code: RoleCode.ORGANIZATION_ADMIN, organizationId: null },
    });
    if (!adminRole) throw new Error('role missing');

    const org = await prisma.organization.create({
      data: { name: 'GitLab Org', slug: `gitlab-org-${Date.now()}` },
    });
    orgId = org.id;

    adminEmail = `gl-admin-${Date.now()}@test.local`;
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        organizationId: org.id,
        email: adminEmail,
        username: `gl_admin_${Date.now()}`,
        passwordHash,
        firstName: 'مدیر',
        lastName: 'GitLab',
        status: 'ACTIVE',
        roles: { create: [{ roleId: adminRole.id }] },
      },
    });

    const emp = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `gl-emp-${Date.now()}@test.local`,
        username: `gl_emp_${Date.now()}`,
        passwordHash,
        firstName: 'کارمند',
        lastName: 'GitLab',
        status: 'ACTIVE',
      },
    });
    employeeId = emp.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    adminToken = login.body.accessToken;
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('پیکربندی اتصال و همگام‌سازی با Mock', async () => {
    await request(app.getHttpServer())
      .post('/api/gitlab/connection')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ baseUrl: 'https://gitlab.example.com', token: 'glpat-test-token-12345678' })
      .expect(201);

    const sync = await request(app.getHttpServer())
      .post('/api/gitlab/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(sync.body.syncedProjects).toBeGreaterThanOrEqual(1);
    expect(mockGitLabClient.listProjects).toHaveBeenCalled();
  });

  it('نگاشت کاربر و پروژه متصل', async () => {
    const connected = await request(app.getHttpServer())
      .post('/api/gitlab/projects/connect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projects: [{ gitlabProjectId: 99, pathWithNamespace: 'org/demo', name: 'demo' }],
      })
      .expect(201);
    projectDbId = connected.body[0].id;

    await request(app.getHttpServer())
      .post('/api/gitlab/mappings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: employeeId, gitlabUserId: 5001, gitlabUsername: 'dev.user' })
      .expect(201);
  });

  it('Webhook MR — idempotency با delivery id', async () => {
    const payload = {
      object_kind: 'merge_request',
      project: { id: 99 },
      user: { id: 5001 },
      object_attributes: {
        id: 7001,
        iid: 3,
        title: 'feat: test',
        state: 'opened',
        source_branch: 'feat',
        target_branch: 'main',
        created_at: '2026-10-01T10:00:00Z',
      },
    };
    const delivery = `delivery-${Date.now()}`;

    await request(app.getHttpServer())
      .post(`/api/gitlab/webhooks?organizationId=${orgId}`)
      .set('X-Gitlab-Token', webhookSecret)
      .set('X-Gitlab-Event', 'Merge Request Hook')
      .set('X-Gitlab-Delivery', delivery)
      .send(payload)
      .expect(201);

    const dup = await request(app.getHttpServer())
      .post(`/api/gitlab/webhooks?organizationId=${orgId}`)
      .set('X-Gitlab-Token', webhookSecret)
      .set('X-Gitlab-Event', 'Merge Request Hook')
      .set('X-Gitlab-Delivery', delivery)
      .send(payload)
      .expect(201);
    expect(dup.body.duplicate).toBe(true);

    const mrCount = await prisma.mergeRequest.count({
      where: { projectId: projectDbId, gitlabMrIid: 3 },
    });
    expect(mrCount).toBe(1);
  });

  it('گزارش فعالیت مهندسی شامل یادداشت ناقص بودن داده', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/gitlab/engineering/activity')
      .query({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.disclaimerFa).toBeDefined();
    expect(Array.isArray(res.body.dataIncompletenessNotesFa)).toBe(true);
  });
});

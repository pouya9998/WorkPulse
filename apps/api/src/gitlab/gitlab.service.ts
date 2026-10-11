import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MergeRequestState, PipelineStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { EncryptionService } from '../common/crypto/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigureConnectionDto } from './dto/configure-connection.dto';
import { ConnectProjectsDto } from './dto/connect-projects.dto';
import { ActivityReportQueryDto } from './dto/activity-report-query.dto';
import { CreateUserMappingDto, UpdateUserMappingDto } from './dto/user-mapping.dto';
import { DefaultGitLabApiClient } from './gitlab-api.client';
import { GITLAB_API_CLIENT, GitLabApiClient } from './gitlab-api.types';

const SYNC_PAGE_DELAY_MS = 250;

@Injectable()
export class GitLabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    @Inject(GITLAB_API_CLIENT)
    private readonly gitlabApi: GitLabApiClient,
  ) {}

  async getConnection(user: AuthUser) {
    const conn = await this.prisma.gitLabConnection.findUnique({
      where: { organizationId: user.organizationId },
    });
    if (!conn) {
      return { configured: false as const };
    }
    return {
      configured: true as const,
      id: conn.id,
      baseUrl: conn.baseUrl,
      status: conn.status,
      lastSyncAt: conn.lastSyncAt,
      lastError: conn.lastError,
      hasToken: Boolean(conn.tokenEncrypted),
    };
  }

  async configureConnection(user: AuthUser, dto: ConfigureConnectionDto) {
    const tokenEncrypted = this.encryption.encrypt(dto.token);
    const conn = await this.prisma.gitLabConnection.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        baseUrl: dto.baseUrl.replace(/\/$/, ''),
        tokenEncrypted,
        status: 'ACTIVE',
        lastError: null,
      },
      update: {
        baseUrl: dto.baseUrl.replace(/\/$/, ''),
        tokenEncrypted,
        status: 'ACTIVE',
        lastError: null,
      },
    });
    return { id: conn.id, baseUrl: conn.baseUrl, status: conn.status };
  }

  async listProjects(user: AuthUser) {
    return this.prisma.gitLabProject.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { pathWithNamespace: 'asc' },
    });
  }

  async connectProjects(user: AuthUser, dto: ConnectProjectsDto) {
    const results = [];
    for (const p of dto.projects) {
      const row = await this.prisma.gitLabProject.upsert({
        where: {
          organizationId_gitlabProjectId: {
            organizationId: user.organizationId,
            gitlabProjectId: p.gitlabProjectId,
          },
        },
        create: {
          organizationId: user.organizationId,
          gitlabProjectId: p.gitlabProjectId,
          pathWithNamespace: p.pathWithNamespace,
          name: p.name,
          isConnected: true,
        },
        update: {
          pathWithNamespace: p.pathWithNamespace,
          name: p.name,
          isConnected: true,
        },
      });
      results.push(row);
    }
    return results;
  }

  async listMappings(user: AuthUser) {
    return this.prisma.gitLabUserMapping.findMany({
      where: { organizationId: user.organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            gitlabUsername: true,
          },
        },
      },
      orderBy: { gitlabUsername: 'asc' },
    });
  }

  async createMapping(user: AuthUser, dto: CreateUserMappingDto) {
    await this.assertOrgUser(user.organizationId, dto.userId);
    return this.prisma.gitLabUserMapping.create({
      data: {
        organizationId: user.organizationId,
        userId: dto.userId,
        gitlabUserId: dto.gitlabUserId,
        gitlabUsername: dto.gitlabUsername,
      },
    });
  }

  async updateMapping(user: AuthUser, id: string, dto: UpdateUserMappingDto) {
    const existing = await this.prisma.gitLabUserMapping.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('نگاشت یافت نشد');
    return this.prisma.gitLabUserMapping.update({
      where: { id },
      data: {
        gitlabUserId: dto.gitlabUserId,
        gitlabUsername: dto.gitlabUsername,
      },
    });
  }

  async deleteMapping(user: AuthUser, id: string) {
    const existing = await this.prisma.gitLabUserMapping.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('نگاشت یافت نشد');
    await this.prisma.gitLabUserMapping.delete({ where: { id } });
    return { ok: true };
  }

  /** همگام‌سازی دوره‌ای — با صفحه‌بندی و تأخیر بین درخواست‌ها */
  async syncOrganization(organizationId: string) {
    const conn = await this.prisma.gitLabConnection.findUnique({
      where: { organizationId },
    });
    if (!conn) {
      throw new BadRequestException('اتصال GitLab پیکربندی نشده');
    }
    const token = this.encryption.decrypt(conn.tokenEncrypted);
    let page = 1;
    let total = 0;
    try {
      for (;;) {
        const remote = await this.gitlabApi.listProjects(conn.baseUrl, token, page);
        if (!remote.length) break;
        for (const p of remote) {
          await this.prisma.gitLabProject.upsert({
            where: {
              organizationId_gitlabProjectId: {
                organizationId,
                gitlabProjectId: p.id,
              },
            },
            create: {
              organizationId,
              gitlabProjectId: p.id,
              pathWithNamespace: p.path_with_namespace,
              name: p.name,
              isConnected: false,
            },
            update: {
              pathWithNamespace: p.path_with_namespace,
              name: p.name,
            },
          });
          total += 1;
        }
        page += 1;
        await this.delay(SYNC_PAGE_DELAY_MS);
        if (page > 50) break;
      }
      await this.prisma.gitLabConnection.update({
        where: { organizationId },
        data: { lastSyncAt: new Date(), status: 'ACTIVE', lastError: null },
      });
      return { syncedProjects: total, pages: page - 1 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'sync failed';
      await this.prisma.gitLabConnection.update({
        where: { organizationId },
        data: { status: 'ERROR', lastError: msg },
      });
      throw err;
    }
  }

  async triggerSync(user: AuthUser) {
    return this.syncOrganization(user.organizationId);
  }

  validateWebhookSecret(headerToken: string | undefined) {
    const secret = this.config.get<string>('GITLAB_WEBHOOK_SECRET');
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Webhook secret پیکربندی نشده');
      }
      return;
    }
    if (!headerToken || headerToken !== secret) {
      throw new UnauthorizedException('توکن Webhook نامعتبر');
    }
  }

  async handleWebhook(
    organizationId: string,
    deliveryId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId الزامی است');
    }
    const existing = await this.prisma.gitLabWebhookEvent.findUnique({
      where: {
        organizationId_deliveryId: { organizationId, deliveryId },
      },
    });
    if (existing) {
      return { duplicate: true, eventId: existing.id };
    }

    await this.prisma.gitLabWebhookEvent.create({
      data: {
        organizationId,
        deliveryId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      },
    });

    if (eventType === 'Merge Request Hook') {
      await this.processMergeRequestWebhook(organizationId, payload);
    } else if (eventType === 'Pipeline Hook') {
      await this.processPipelineWebhook(organizationId, payload);
    } else if (eventType === 'Push Hook') {
      await this.processPushWebhook(organizationId, payload);
    }

    return { duplicate: false, processed: true };
  }

  async engineeringActivityReport(user: AuthUser, query: ActivityReportQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const orgId = user.organizationId;

    const targetUserIds = query.userId
      ? [query.userId]
      : (
          await this.prisma.user.findMany({
            where: { organizationId: orgId, status: 'ACTIVE' },
            select: { id: true },
          })
        ).map((u) => u.id);

    if (query.userId && query.userId === user.id) {
      // کارمند فقط خودش
    } else if (
      query.userId &&
      query.userId !== user.id &&
      !user.permissions.includes('engineering:read') &&
      !user.permissions.includes('users:read')
    ) {
      throw new ForbiddenException('دسترسی به گزارش دیگران مجاز نیست');
    } else if (!query.userId && !user.permissions.includes('engineering:read')) {
      throw new ForbiddenException('دسترسی به گزارش تیم مجاز نیست');
    }

    const mappings = await this.prisma.gitLabUserMapping.findMany({
      where: { organizationId: orgId },
    });
    const mappedUserIds = new Set(mappings.map((m) => m.userId));
    const incompleteness: string[] = [];
    if (mappings.length === 0) {
      incompleteness.push('هیچ نگاشت کاربر GitLab ثبت نشده؛ داده‌ها ناقص هستند.');
    }
    const unmapped = targetUserIds.filter((id) => !mappedUserIds.has(id));
    if (unmapped.length > 0) {
      incompleteness.push(
        `${unmapped.length} کاربر بدون نگاشت GitLab — فعالیت آن‌ها در گزارش ممکن است ناقص باشد.`,
      );
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: targetUserIds }, organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const rows = [];
    for (const u of users) {
      const [mrOpened, mrMerged, reviewsGiven, pipelinesRun] = await Promise.all([
        this.prisma.mergeRequest.count({
          where: {
            organizationId: orgId,
            userId: u.id,
            openedAt: { gte: from, lte: to },
          },
        }),
        this.prisma.mergeRequest.count({
          where: {
            organizationId: orgId,
            userId: u.id,
            mergedAt: { gte: from, lte: to },
          },
        }),
        this.prisma.review.count({
          where: {
            organizationId: orgId,
            userId: u.id,
            reviewedAt: { gte: from, lte: to },
          },
        }),
        this.prisma.pipeline.count({
          where: {
            organizationId: orgId,
            userId: u.id,
            startedAt: { gte: from, lte: to },
          },
        }),
      ]);

      rows.push({
        user: u,
        metrics: {
          mergeRequestsOpened: mrOpened,
          mergeRequestsMerged: mrMerged,
          reviewsGiven,
          pipelinesRun,
          commitCountNote:
            'تعداد Commit به‌تنهایی معیار بهره‌وری نیست و در امتیازدهی استفاده نمی‌شود.',
        },
      });
    }

    return {
      period: { from: query.from, to: query.to },
      disclaimerFa:
        'این گزارش فقط فعالیت ثبت‌شده در GitLab را نشان می‌دهد؛ MR/Review/Pipeline به‌معنای بهره‌وری قطعی نیست.',
      dataIncompletenessNotesFa: incompleteness,
      rows,
    };
  }

  private async processMergeRequestWebhook(
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    const projectId = Number((payload.project as { id?: number })?.id);
    const attrs = payload.object_attributes as Record<string, unknown> | undefined;
    if (!projectId || !attrs) return;

    const project = await this.prisma.gitLabProject.findFirst({
      where: { organizationId, gitlabProjectId: projectId, isConnected: true },
    });
    if (!project) return;

    const authorId = Number((payload.user as { id?: number })?.id);
    const userId = await this.resolveUserId(organizationId, authorId);

    const state = this.mapMrState(String(attrs.state || 'opened'));
    const iid = Number(attrs.iid);
    const mrId = Number(attrs.id);

    await this.prisma.mergeRequest.upsert({
      where: { projectId_gitlabMrIid: { projectId: project.id, gitlabMrIid: iid } },
      create: {
        organizationId,
        projectId: project.id,
        userId,
        gitlabMrIid: iid,
        gitlabMrId: mrId,
        title: String(attrs.title || ''),
        state,
        sourceBranch: String(attrs.source_branch || ''),
        targetBranch: String(attrs.target_branch || ''),
        authorGitlabId: authorId || null,
        openedAt: attrs.created_at ? new Date(String(attrs.created_at)) : null,
        mergedAt: attrs.merged_at ? new Date(String(attrs.merged_at)) : null,
        closedAt: attrs.closed_at ? new Date(String(attrs.closed_at)) : null,
        updatedAtGitlab: attrs.updated_at ? new Date(String(attrs.updated_at)) : null,
      },
      update: {
        userId,
        title: String(attrs.title || ''),
        state,
        mergedAt: attrs.merged_at ? new Date(String(attrs.merged_at)) : null,
        closedAt: attrs.closed_at ? new Date(String(attrs.closed_at)) : null,
        updatedAtGitlab: attrs.updated_at ? new Date(String(attrs.updated_at)) : null,
      },
    });
  }

  private async processPipelineWebhook(
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    const projectId = Number((payload.project as { id?: number })?.id);
    const attrs = payload.object_attributes as Record<string, unknown> | undefined;
    if (!projectId || !attrs) return;

    const project = await this.prisma.gitLabProject.findFirst({
      where: { organizationId, gitlabProjectId: projectId, isConnected: true },
    });
    if (!project) return;

    const userId = await this.resolveUserId(
      organizationId,
      Number((payload.user as { id?: number })?.id),
    );

    const pipelineId = Number(attrs.id);
    const status = this.mapPipelineStatus(String(attrs.status || 'created'));

    await this.prisma.pipeline.upsert({
      where: {
        projectId_gitlabPipelineId: {
          projectId: project.id,
          gitlabPipelineId: pipelineId,
        },
      },
      create: {
        organizationId,
        projectId: project.id,
        userId,
        gitlabPipelineId: pipelineId,
        ref: String(attrs.ref || ''),
        status,
        startedAt: attrs.created_at ? new Date(String(attrs.created_at)) : null,
        finishedAt: attrs.finished_at ? new Date(String(attrs.finished_at)) : null,
      },
      update: {
        userId,
        status,
        finishedAt: attrs.finished_at ? new Date(String(attrs.finished_at)) : null,
      },
    });
  }

  private async processPushWebhook(organizationId: string, payload: Record<string, unknown>) {
    const projectId = Number((payload.project_id as number) || (payload.project as { id?: number })?.id);
    const commits = (payload.commits as unknown[]) || [];
    if (!projectId || !commits.length) return;

    const project = await this.prisma.gitLabProject.findFirst({
      where: { organizationId, gitlabProjectId: projectId, isConnected: true },
    });
    if (!project) return;

    const authorId = Number((payload.user_id as number) || (payload.user as { id?: number })?.id);
    const userId = await this.resolveUserId(organizationId, authorId);
    if (!userId) return;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await this.prisma.engineeringMetric.upsert({
      where: {
        organizationId_userId_periodStart_periodEnd: {
          organizationId,
          userId,
          periodStart,
          periodEnd,
        },
      },
      create: {
        organizationId,
        userId,
        periodStart,
        periodEnd,
        commitCount: commits.length,
        notesFa: 'commit_count صرفاً آماری است؛ معیار بهره‌وری نیست.',
      },
      update: {
        commitCount: { increment: commits.length },
      },
    });
  }

  private async resolveUserId(organizationId: string, gitlabUserId?: number) {
    if (!gitlabUserId) return null;
    const map = await this.prisma.gitLabUserMapping.findFirst({
      where: { organizationId, gitlabUserId },
    });
    return map?.userId ?? null;
  }

  private mapMrState(state: string): MergeRequestState {
    if (state === 'merged') return 'MERGED';
    if (state === 'closed') return 'CLOSED';
    return 'OPENED';
  }

  private mapPipelineStatus(status: string): PipelineStatus {
    const map: Record<string, PipelineStatus> = {
      created: 'CREATED',
      running: 'RUNNING',
      success: 'SUCCESS',
      failed: 'FAILED',
      canceled: 'CANCELED',
      skipped: 'SKIPPED',
    };
    return map[status.toLowerCase()] ?? 'CREATED';
  }

  private async assertOrgUser(organizationId: string, userId: string) {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });
    if (!u) throw new BadRequestException('کاربر در این سازمان نیست');
  }

  private delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

export { DefaultGitLabApiClient };

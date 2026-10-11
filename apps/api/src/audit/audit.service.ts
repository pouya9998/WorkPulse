import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry) {
    // هرگز رمز عبور یا توکن را در metadata لاگ نکنید
    const safeMetadata = this.sanitize(entry.metadata);
    return this.prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId ?? undefined,
        actorUserId: entry.actorUserId ?? undefined,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? undefined,
        metadata: safeMetadata,
        ipAddress: entry.ipAddress ?? undefined,
      },
    });
  }

  async list(organizationId: string, take = 50, skip = 0) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where: { organizationId } }),
    ]);
    return { items, total, take, skip };
  }

  private sanitize(metadata?: Prisma.InputJsonValue): Prisma.InputJsonValue | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return metadata;
    }
    const blocked = ['password', 'passwordHash', 'token', 'accessToken', 'secret', 'apiKey'];
    const copy: Record<string, unknown> = { ...(metadata as Record<string, unknown>) };
    for (const key of Object.keys(copy)) {
      if (blocked.some((b) => key.toLowerCase().includes(b.toLowerCase()))) {
        copy[key] = '[REDACTED]';
      }
    }
    return copy as Prisma.InputJsonValue;
  }
}

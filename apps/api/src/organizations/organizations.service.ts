import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: { select: { users: true, teams: true } },
      },
    });
    if (!org) {
      throw new NotFoundException('سازمان یافت نشد');
    }
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      locale: org.locale,
      isActive: org.isActive,
      userCount: org._count.users,
      teamCount: org._count.teams,
      createdAt: org.createdAt,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendancePolicyDto } from './dto/create-attendance-policy.dto';
import { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';

@Injectable()
export class AttendancePoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.attendancePolicy.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(user: AuthUser, dto: CreateAttendancePolicyDto) {
    if (dto.isDefault) {
      await this.prisma.attendancePolicy.updateMany({
        where: { organizationId: user.organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.attendancePolicy.create({
      data: {
        organizationId: user.organizationId,
        nameFa: dto.nameFa,
        expectedWorkStartUtc: dto.expectedWorkStartUtc,
        expectedWorkEndUtc: dto.expectedWorkEndUtc,
        graceMinutes: dto.graceMinutes ?? 15,
        heartbeatTimeoutMinutes: dto.heartbeatTimeoutMinutes ?? 2,
        maxBreakMinutes: dto.maxBreakMinutes ?? 60,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
        notesFa: dto.notesFa,
      },
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateAttendancePolicyDto) {
    const existing = await this.prisma.attendancePolicy.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) throw new NotFoundException('سیاست یافت نشد');

    if (dto.isDefault) {
      await this.prisma.attendancePolicy.updateMany({
        where: { organizationId: user.organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.attendancePolicy.update({
      where: { id },
      data: {
        nameFa: dto.nameFa,
        expectedWorkStartUtc: dto.expectedWorkStartUtc,
        expectedWorkEndUtc: dto.expectedWorkEndUtc,
        graceMinutes: dto.graceMinutes,
        heartbeatTimeoutMinutes: dto.heartbeatTimeoutMinutes,
        maxBreakMinutes: dto.maxBreakMinutes,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
        notesFa: dto.notesFa,
      },
    });
  }
}

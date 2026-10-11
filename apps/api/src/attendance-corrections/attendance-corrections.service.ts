import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceCorrectionStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceCorrectionDto } from './dto/create-attendance-correction.dto';
import { ReviewAttendanceCorrectionDto } from './dto/review-attendance-correction.dto';

@Injectable()
export class AttendanceCorrectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private canReview(user: AuthUser) {
    return user.permissions.includes(PERMISSIONS.ATTENDANCE_MANAGE);
  }

  async list(user: AuthUser, status?: AttendanceCorrectionStatus) {
    const where: Prisma.AttendanceCorrectionWhereInput = {
      organizationId: user.organizationId,
    };
    if (!this.canReview(user)) {
      where.userId = user.id;
    }
    if (status) where.status = status;

    return this.prisma.attendanceCorrection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        workSession: { select: { id: true, startedAt: true, endedAt: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateAttendanceCorrectionDto) {
    if (dto.workSessionId) {
      const session = await this.prisma.workSession.findFirst({
        where: {
          id: dto.workSessionId,
          userId: user.id,
          organizationId: user.organizationId,
        },
      });
      if (!session) throw new BadRequestException('نشست کاری نامعتبر است');
    }

    const correction = await this.prisma.attendanceCorrection.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        workSessionId: dto.workSessionId,
        requestedStartAt: dto.requestedStartAt,
        requestedEndAt: dto.requestedEndAt,
        reasonFa: dto.reasonFa,
      },
    });

    await this.audit.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'attendance_correction.requested',
      entityType: 'AttendanceCorrection',
      entityId: correction.id,
    });

    return correction;
  }

  async approve(user: AuthUser, id: string, dto: ReviewAttendanceCorrectionDto) {
    if (!this.canReview(user)) {
      throw new ForbiddenException('مجوز بازبینی اصلاح وجود ندارد');
    }
    return this.review(user, id, AttendanceCorrectionStatus.APPROVED, dto.reviewNotesFa);
  }

  async reject(user: AuthUser, id: string, dto: ReviewAttendanceCorrectionDto) {
    if (!this.canReview(user)) {
      throw new ForbiddenException('مجوز بازبینی اصلاح وجود ندارد');
    }
    if (!dto.reviewNotesFa?.trim()) {
      throw new BadRequestException('دلیل رد الزامی است');
    }
    return this.review(user, id, AttendanceCorrectionStatus.REJECTED, dto.reviewNotesFa);
  }

  private async review(
    user: AuthUser,
    id: string,
    status: AttendanceCorrectionStatus,
    reviewNotesFa?: string,
  ) {
    const correction = await this.prisma.attendanceCorrection.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!correction) throw new NotFoundException('درخواست اصلاح یافت نشد');
    if (correction.status !== AttendanceCorrectionStatus.PENDING) {
      throw new BadRequestException('این درخواست قبلاً رسیدگی شده است');
    }

    const updated = await this.prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status,
        reviewNotesFa,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action:
        status === AttendanceCorrectionStatus.APPROVED
          ? 'attendance_correction.approved'
          : 'attendance_correction.rejected',
      entityType: 'AttendanceCorrection',
      entityId: id,
      metadata: { reviewNotesFa },
    });

    return updated;
  }
}

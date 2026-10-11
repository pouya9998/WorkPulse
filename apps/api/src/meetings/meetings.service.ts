import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CalendarProvider,
  MeetingParticipantRole,
  MeetingStatus,
  WorkSessionStatus,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AlertsEngineService } from '../alerts/alerts-engine.service';
import { PERMISSIONS } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarAdapterRegistry } from './calendar/calendar-adapter.registry';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import { RecordMeetingAttendanceDto } from './dto/meeting-attendance.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendars: CalendarAdapterRegistry,
    private readonly alertsEngine: AlertsEngineService,
  ) {}

  private canManage(user: AuthUser) {
    return user.permissions.includes(PERMISSIONS.MEETINGS_MANAGE);
  }

  async list(user: AuthUser, query: ListMeetingsQueryDto) {
    const from = query.from ?? new Date(Date.now() - 7 * 86400_000);
    const to = query.to ?? new Date(Date.now() + 14 * 86400_000);

    const where = {
      organizationId: user.organizationId,
      status: MeetingStatus.SCHEDULED,
      startAt: { lt: to },
      endAt: { gt: from },
    };

    if (!this.canManage(user)) {
      return this.prisma.meeting.findMany({
        where: {
          ...where,
          participants: { some: { userId: user.id } },
        },
        orderBy: { startAt: 'asc' },
        include: {
          participants: {
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
          },
          occurrences: true,
        },
      });
    }

    return this.prisma.meeting.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        occurrences: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateMeetingDto) {
    if (dto.endAt <= dto.startAt) {
      throw new BadRequestException('زمان پایان باید بعد از شروع باشد');
    }

    await this.ensureParticipantsInOrg(user.organizationId, dto.participants.map((p) => p.userId));

    const meeting = await this.prisma.meeting.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.id,
        titleFa: dto.titleFa,
        descriptionFa: dto.descriptionFa,
        startAt: dto.startAt,
        endAt: dto.endAt,
        participants: {
          create: dto.participants.map((p) => ({
            userId: p.userId,
            role: p.role ?? MeetingParticipantRole.REQUIRED,
          })),
        },
        occurrences: {
          create: {
            startAt: dto.startAt,
            endAt: dto.endAt,
          },
        },
      },
      include: { participants: true, occurrences: true },
    });

    for (const p of dto.participants) {
      await this.ensureManualCalendarConnection(p.userId, user.organizationId);
      await this.checkWorkSessionOverlaps(user.organizationId, p.userId, meeting.id, dto.startAt, dto.endAt);
    }

    return meeting;
  }

  async update(user: AuthUser, id: string, dto: UpdateMeetingDto) {
    const meeting = await this.findMeeting(user, id);
    if (!this.canManage(user) && meeting.createdById !== user.id) {
      throw new ForbiddenException('دسترسی کافی نیست');
    }

    const startAt = dto.startAt ?? meeting.startAt;
    const endAt = dto.endAt ?? meeting.endAt;
    if (endAt <= startAt) {
      throw new BadRequestException('زمان پایان باید بعد از شروع باشد');
    }

    return this.prisma.meeting.update({
      where: { id },
      data: {
        titleFa: dto.titleFa,
        descriptionFa: dto.descriptionFa,
        startAt: dto.startAt,
        endAt: dto.endAt,
      },
      include: { participants: true, occurrences: true },
    });
  }

  async cancel(user: AuthUser, id: string) {
    const meeting = await this.findMeeting(user, id);
    if (!this.canManage(user) && meeting.createdById !== user.id) {
      throw new ForbiddenException('دسترسی کافی نیست');
    }

    const now = new Date();
    return this.prisma.meeting.update({
      where: { id },
      data: {
        status: MeetingStatus.CANCELLED,
        cancelledAt: now,
        occurrences: {
          updateMany: {
            where: { cancelledAt: null },
            data: { cancelledAt: now },
          },
        },
      },
    });
  }

  async detectOverlaps(user: AuthUser, meetingId: string) {
    return this.detectOverlapsForMeeting(user, meetingId);
  }

  async detectOverlapsForMeeting(user: AuthUser, meetingId: string) {
    const meeting = await this.findMeeting(user, meetingId);
    const overlaps: Array<{
      userId: string;
      workSessionId: string;
      sessionStart: Date;
      sessionEnd: Date | null;
    }> = [];

    for (const p of await this.prisma.meetingParticipant.findMany({
      where: { meetingId: meeting.id },
    })) {
      const sessions = await this.prisma.workSession.findMany({
        where: {
          userId: p.userId,
          organizationId: user.organizationId,
          startedAt: { lt: meeting.endAt },
          OR: [{ endedAt: null }, { endedAt: { gt: meeting.startAt } }],
        },
      });
      for (const s of sessions) {
        overlaps.push({
          userId: p.userId,
          workSessionId: s.id,
          sessionStart: s.startedAt,
          sessionEnd: s.endedAt,
        });
        if (s.status === WorkSessionStatus.OPEN) {
          await this.alertsEngine.notifyMeetingConflictPlaceholder(
            user.organizationId,
            p.userId,
            meeting.id,
            s.id,
          );
        }
      }
    }

    return { meetingId: meeting.id, overlaps };
  }

  async recordAttendance(
    user: AuthUser,
    occurrenceId: string,
    dto: RecordMeetingAttendanceDto,
  ) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('مجوز ثبت حضور جلسه وجود ندارد');
    }

    const occurrence = await this.prisma.meetingOccurrence.findFirst({
      where: { id: occurrenceId },
      include: { meeting: true },
    });
    if (!occurrence || occurrence.meeting.organizationId !== user.organizationId) {
      throw new NotFoundException('رخداد جلسه یافت نشد');
    }

    return this.prisma.meetingAttendanceRecord.upsert({
      where: {
        meetingOccurrenceId_userId: {
          meetingOccurrenceId: occurrenceId,
          userId: dto.userId,
        },
      },
      update: {
        actualJoinedAt: dto.actualJoinedAt,
        actualLeftAt: dto.actualLeftAt,
        notesFa: dto.notesFa,
        recordedById: user.id,
      },
      create: {
        meetingOccurrenceId: occurrenceId,
        userId: dto.userId,
        actualJoinedAt: dto.actualJoinedAt,
        actualLeftAt: dto.actualLeftAt,
        notesFa: dto.notesFa,
        recordedById: user.id,
      },
    });
  }

  async listCalendarEvents(user: AuthUser, from: Date, to: Date) {
    const conn = await this.prisma.calendarConnection.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
      orderBy: { updatedAt: 'desc' },
    });
    const provider = conn?.provider ?? CalendarProvider.MANUAL;
    const adapter = this.calendars.get(provider);
    return adapter.listEvents(user.id, from, to);
  }

  private async findMeeting(user: AuthUser, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!meeting) throw new NotFoundException('جلسه یافت نشد');
    return meeting;
  }

  private async ensureParticipantsInOrg(organizationId: string, userIds: string[]) {
    const count = await this.prisma.user.count({
      where: { organizationId, id: { in: userIds }, status: 'ACTIVE' },
    });
    if (count !== userIds.length) {
      throw new BadRequestException('برخی شرکت‌کنندگان در سازمان یافت نشدند');
    }
  }

  private async ensureManualCalendarConnection(userId: string, organizationId: string) {
    await this.prisma.calendarConnection.upsert({
      where: {
        organizationId_userId_provider: {
          organizationId,
          userId,
          provider: CalendarProvider.MANUAL,
        },
      },
      update: {},
      create: {
        organizationId,
        userId,
        provider: CalendarProvider.MANUAL,
        status: 'ACTIVE',
      },
    });
  }

  private async checkWorkSessionOverlaps(
    organizationId: string,
    userId: string,
    meetingId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const sessions = await this.prisma.workSession.findMany({
      where: {
        userId,
        organizationId,
        startedAt: { lt: endAt },
        OR: [{ endedAt: null }, { endedAt: { gt: startAt } }],
      },
    });
    for (const s of sessions) {
      if (s.status === WorkSessionStatus.OPEN) {
        await this.alertsEngine.notifyMeetingConflictPlaceholder(
          organizationId,
          userId,
          meetingId,
          s.id,
        );
      }
    }
  }
}

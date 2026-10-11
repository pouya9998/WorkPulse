import { Injectable } from '@nestjs/common';
import { CalendarProvider, MeetingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarAdapter, ExternalCalendarEvent } from './calendar-adapter.interface';

/** رویدادهای ثبت‌شده دستی در WorkPulse — بدون OAuth */
@Injectable()
export class ManualCalendarAdapter implements CalendarAdapter {
  readonly provider = CalendarProvider.MANUAL;

  constructor(private readonly prisma: PrismaService) {}

  async isConfigured(userId: string): Promise<boolean> {
    const conn = await this.prisma.calendarConnection.findFirst({
      where: { userId, provider: CalendarProvider.MANUAL },
    });
    return !!conn;
  }

  async listEvents(userId: string, from: Date, to: Date): Promise<ExternalCalendarEvent[]> {
    const participations = await this.prisma.meetingParticipant.findMany({
      where: { userId },
      include: {
        meeting: true,
      },
    });

    return participations
      .filter(
        (p) =>
          p.meeting.status === MeetingStatus.SCHEDULED &&
          p.meeting.startAt < to &&
          p.meeting.endAt > from,
      )
      .map((p) => ({
        externalId: p.meeting.id,
        title: p.meeting.titleFa,
        startAt: p.meeting.startAt,
        endAt: p.meeting.endAt,
      }));
  }
}

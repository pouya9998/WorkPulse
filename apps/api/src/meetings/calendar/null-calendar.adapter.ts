import { Injectable } from '@nestjs/common';
import { CalendarProvider } from '@prisma/client';
import { CalendarAdapter, ExternalCalendarEvent } from './calendar-adapter.interface';

@Injectable()
export class NullCalendarAdapter implements CalendarAdapter {
  readonly provider = CalendarProvider.NONE;

  async isConfigured(): Promise<boolean> {
    return false;
  }

  async listEvents(): Promise<ExternalCalendarEvent[]> {
    return [];
  }
}

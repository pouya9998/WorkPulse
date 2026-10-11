import { CalendarProvider } from '@prisma/client';

export interface ExternalCalendarEvent {
  externalId: string;
  title: string;
  startAt: Date;
  endAt: Date;
}

export interface CalendarAdapter {
  readonly provider: CalendarProvider;
  listEvents(userId: string, from: Date, to: Date): Promise<ExternalCalendarEvent[]>;
  isConfigured(userId: string): Promise<boolean>;
}

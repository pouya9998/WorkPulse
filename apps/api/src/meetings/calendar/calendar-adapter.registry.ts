import { Injectable } from '@nestjs/common';
import { CalendarProvider } from '@prisma/client';
import { CalendarAdapter } from './calendar-adapter.interface';
import { ManualCalendarAdapter } from './manual-calendar.adapter';
import { NullCalendarAdapter } from './null-calendar.adapter';

@Injectable()
export class CalendarAdapterRegistry {
  private readonly adapters: Map<CalendarProvider, CalendarAdapter>;

  constructor(
    manual: ManualCalendarAdapter,
    none: NullCalendarAdapter,
  ) {
    this.adapters = new Map<CalendarProvider, CalendarAdapter>([
      [CalendarProvider.MANUAL, manual],
      [CalendarProvider.NONE, none],
      [CalendarProvider.GOOGLE, none],
      [CalendarProvider.OUTLOOK, none],
    ]);
  }

  get(provider: CalendarProvider): CalendarAdapter {
    return this.adapters.get(provider) ?? this.adapters.get(CalendarProvider.NONE)!;
  }
}

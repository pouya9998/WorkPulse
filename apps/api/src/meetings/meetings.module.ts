import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { CalendarAdapterRegistry } from './calendar/calendar-adapter.registry';
import { ManualCalendarAdapter } from './calendar/manual-calendar.adapter';
import { NullCalendarAdapter } from './calendar/null-calendar.adapter';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [AlertsModule],
  controllers: [MeetingsController],
  providers: [
    MeetingsService,
    CalendarAdapterRegistry,
    ManualCalendarAdapter,
    NullCalendarAdapter,
  ],
})
export class MeetingsModule {}

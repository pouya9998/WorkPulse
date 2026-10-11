import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsController } from './alerts.controller';
import { AlertsEngineService } from './alerts-engine.service';
import { AlertsSchedulerService } from './alerts-scheduler.service';
import { AlertsService } from './alerts.service';

@Module({
  imports: [ScheduleModule.forRoot(), NotificationsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsEngineService, AlertsSchedulerService],
  exports: [AlertsEngineService],
})
export class AlertsModule {}

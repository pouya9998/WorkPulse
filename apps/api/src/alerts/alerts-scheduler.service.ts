import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertsEngineService } from './alerts-engine.service';

@Injectable()
export class AlertsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsSchedulerService.name);
  private interval?: ReturnType<typeof setInterval>;

  constructor(private readonly engine: AlertsEngineService) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      void this.engine.checkHeartbeatExpired();
    }, 60_000);
    this.logger.log('بررسی heartbeat هر ۶۰ ثانیه فعال شد');
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runPeriodicChecks() {
    await this.engine.runScheduledChecks();
  }
}

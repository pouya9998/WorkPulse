import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { AgentController } from './agent.controller';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [DevicesModule],
  controllers: [AttendanceController, AgentController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}

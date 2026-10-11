import { Module } from '@nestjs/common';
import { AttendancePoliciesController } from './attendance-policies.controller';
import { AttendancePoliciesService } from './attendance-policies.service';

@Module({
  controllers: [AttendancePoliciesController],
  providers: [AttendancePoliciesService],
})
export class AttendancePoliciesModule {}

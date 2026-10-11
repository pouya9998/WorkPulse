import { PartialType } from '@nestjs/swagger';
import { CreateAttendancePolicyDto } from './create-attendance-policy.dto';

export class UpdateAttendancePolicyDto extends PartialType(CreateAttendancePolicyDto) {}

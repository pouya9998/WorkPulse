import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ActivityReportQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

import { IsArray, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePayrollPeriodDto {
  @IsString()
  @MinLength(2)
  labelFa!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}

export class GenerateProposalsBodyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}

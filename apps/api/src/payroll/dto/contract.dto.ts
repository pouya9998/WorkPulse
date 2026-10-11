import { ContractType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateContractDto {
  @IsString()
  userId!: string;

  @IsEnum(ContractType)
  contractType!: ContractType;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumberString()
  hourlyRate?: string;

  @IsOptional()
  @IsNumberString()
  baseMonthly?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  noteFa?: string;
}

export class NewContractVersionDto {
  @IsOptional()
  @IsNumberString()
  hourlyRate?: string;

  @IsOptional()
  @IsNumberString()
  baseMonthly?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  noteFa?: string;
}

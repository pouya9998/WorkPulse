import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const TIME_UTC = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateAttendancePolicyDto {
  @ApiProperty({ example: 'سیاست پیش‌فرض' })
  @IsString()
  @MaxLength(200)
  nameFa!: string;

  @ApiProperty({ example: '06:00', description: 'ساعت شروع مورد انتظار (UTC)' })
  @Matches(TIME_UTC)
  expectedWorkStartUtc!: string;

  @ApiProperty({ example: '15:00', description: 'ساعت پایان مورد انتظار (UTC)' })
  @Matches(TIME_UTC)
  expectedWorkEndUtc!: string;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  graceMinutes?: number;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  heartbeatTimeoutMinutes?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  maxBreakMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notesFa?: string;
}

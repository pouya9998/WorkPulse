import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceEventType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SyncEventItemDto {
  @ApiProperty({ description: 'شناسه یکتای رویداد سمت کلاینت برای جلوگیری از تکرار' })
  @IsString()
  @MinLength(8)
  clientEventId!: string;

  @ApiProperty({ enum: AttendanceEventType })
  @IsEnum(AttendanceEventType)
  type!: AttendanceEventType;

  @ApiProperty({ description: 'زمان رویداد روی دستگاه (ISO UTC)' })
  @IsDateString()
  occurredAtDevice!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class SyncEventsDto {
  @ApiProperty({ type: [SyncEventItemDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SyncEventItemDto)
  events!: SyncEventItemDto[];
}

export class FocusedAppDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  processName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  appName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  windowTitle?: string;

  @ApiPropertyOptional({ description: 'Best-effort active browser URL' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  url?: string;

  @ApiPropertyOptional({ description: 'Normalized title / file path / media title' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  detail?: string;
}

export class HeartbeatDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  clientEventId!: string;

  @ApiProperty()
  @IsDateString()
  sentAtDevice!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  idleSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentVersion?: string;

  @ApiPropertyOptional({ type: FocusedAppDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FocusedAppDto)
  focusedApp?: FocusedAppDto;
}

export class WorkActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  clientEventId!: string;

  @ApiProperty()
  @IsDateString()
  occurredAtDevice!: string;
}

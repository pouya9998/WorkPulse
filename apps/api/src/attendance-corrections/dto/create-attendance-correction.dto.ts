import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAttendanceCorrectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workSessionId?: string;

  @ApiPropertyOptional({ description: 'زمان شروع پیشنهادی (UTC)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  requestedStartAt?: Date;

  @ApiPropertyOptional({ description: 'زمان پایان پیشنهادی (UTC)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  requestedEndAt?: Date;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  reasonFa!: string;
}

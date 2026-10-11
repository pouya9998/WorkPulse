import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AlertNotesDto {
  @ApiPropertyOptional({ description: 'یادداشت فارسی' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notesFa?: string;
}

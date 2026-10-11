import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class ListMeetingsQueryDto {
  @ApiPropertyOptional({ description: 'از (UTC)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'تا (UTC)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

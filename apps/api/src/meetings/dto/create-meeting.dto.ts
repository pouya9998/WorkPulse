import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeetingParticipantRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class MeetingParticipantDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ enum: MeetingParticipantRole })
  @IsOptional()
  @IsEnum(MeetingParticipantRole)
  role?: MeetingParticipantRole;
}

export class CreateMeetingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(300)
  titleFa!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descriptionFa?: string;

  @ApiProperty({ description: 'شروع (UTC)' })
  @Type(() => Date)
  @IsDate()
  startAt!: Date;

  @ApiProperty({ description: 'پایان (UTC)' })
  @Type(() => Date)
  @IsDate()
  endAt!: Date;

  @ApiProperty({ type: [MeetingParticipantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MeetingParticipantDto)
  participants!: MeetingParticipantDto[];
}

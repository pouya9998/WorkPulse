import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'employee@example.com' })
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'laptop-uid-abc123', description: 'شناسه پایدار دستگاه روی کلاینت' })
  @IsString()
  @MinLength(8)
  deviceUid!: string;

  @ApiProperty({ example: 'لپ‌تاپ کاری' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'linux' })
  @IsString()
  platform!: string;

  @ApiPropertyOptional({ example: '6.8.0' })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiProperty({ example: '0.2.0' })
  @IsString()
  agentVersion!: string;
}

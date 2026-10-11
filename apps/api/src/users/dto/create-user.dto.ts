import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType, RoleCode } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'علی' })
  @IsString()
  @MinLength(2, { message: 'نام باید حداقل ۲ کاراکتر باشد' })
  firstName!: string;

  @ApiProperty({ example: 'محمدی' })
  @IsString()
  @MinLength(2, { message: 'نام خانوادگی باید حداقل ۲ کاراکتر باشد' })
  lastName!: string;

  @ApiProperty({ example: 'ali.mohammadi@example.com' })
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email!: string;

  @ApiPropertyOptional({ example: 'ali.mohammadi' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, { message: 'نام کاربری فقط می‌تواند شامل حروف لاتین، عدد و ._- باشد' })
  username?: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد' })
  password!: string;

  @ApiPropertyOptional({ example: '09121234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'مهندس نرم‌افزار' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiProperty({ enum: ContractType, example: ContractType.FULL_TIME_REMOTE })
  @IsEnum(ContractType, { message: 'نوع قرارداد نامعتبر است' })
  contractType!: ContractType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'تاریخ شروع همکاری نامعتبر است' })
  hireDate?: string;

  @ApiPropertyOptional({ example: 'Asia/Tehran' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ enum: RoleCode, isArray: true, example: [RoleCode.EMPLOYEE] })
  @IsEnum(RoleCode, { each: true, message: 'نقش نامعتبر است' })
  roles!: RoleCode[];

  @ApiPropertyOptional({ description: 'شناسه تیم برای تخصیص اولیه' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه تیم نامعتبر است' })
  teamId?: string;

  @ApiPropertyOptional({ example: 'ali.mohammadi' })
  @IsOptional()
  @IsString()
  gitlabUsername?: string;
}

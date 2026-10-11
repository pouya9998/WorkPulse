import { IsInt, IsString, MinLength } from 'class-validator';

export class CreateUserMappingDto {
  @IsString()
  userId!: string;

  @IsInt()
  gitlabUserId!: number;

  @IsString()
  @MinLength(1)
  gitlabUsername!: string;
}

export class UpdateUserMappingDto {
  @IsInt()
  gitlabUserId!: number;

  @IsString()
  @MinLength(1)
  gitlabUsername!: string;
}

import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, ValidateNested } from 'class-validator';

export class ConnectProjectItemDto {
  @IsInt()
  gitlabProjectId!: number;

  @IsString()
  pathWithNamespace!: string;

  @IsString()
  name!: string;
}

export class ConnectProjectsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConnectProjectItemDto)
  projects!: ConnectProjectItemDto[];
}

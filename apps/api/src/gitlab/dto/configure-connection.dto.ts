import { IsString, IsUrl, MinLength } from 'class-validator';

export class ConfigureConnectionDto {
  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsString()
  @MinLength(8)
  token!: string;
}

import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ReviewProposalDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MinLength(1)
  reviewerNotes?: string;
}

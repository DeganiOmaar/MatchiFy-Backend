import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateProposalDto {
  @ApiProperty({
    description: 'Mission ID targeted by the proposal',
    example: '673ab2c3e8f9a1234567890c',
  })
  @IsString()
  @IsNotEmpty()
  missionId: string;

  @ApiProperty({
    description: 'Cover letter / message sent with the proposal',
    example: 'I have 5 years of experience building scalable iOS apps...',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Optional budget proposed by the talent',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  proposedBudget?: number;

  @ApiProperty({
    description: 'Optional estimation for the engagement duration',
    example: '12 weeks',
    required: false,
  })
  @IsOptional()
  @IsString()
  estimatedDuration?: string;
}


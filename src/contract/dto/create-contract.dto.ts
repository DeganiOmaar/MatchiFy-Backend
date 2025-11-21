import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateContractDto {
  @ApiProperty({
    description: 'Mission ID',
    example: '673ab2c3e8f9a1234567890c',
  })
  @IsString()
  @IsNotEmpty()
  missionId: string;

  @ApiProperty({
    description: 'Talent ID',
    example: '673ab2c3e8f9a1234567890d',
  })
  @IsString()
  @IsNotEmpty()
  talentId: string;

  @ApiProperty({
    description: 'Contract title',
    example: 'Contrat de prestation - Développeur Full Stack',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Contract terms/content',
    example: 'Les termes et conditions du contrat...',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Payment details',
    example: '50000€ - Paiement mensuel',
  })
  @IsOptional()
  @IsString()
  paymentDetails?: string;

  @ApiPropertyOptional({
    description: 'Start date',
    example: '2025-02-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date',
    example: '2025-08-01',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Recruiter signature (base64 encoded image)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
  })
  @IsString()
  @IsNotEmpty()
  recruiterSignature: string;
}


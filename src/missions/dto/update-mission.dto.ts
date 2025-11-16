import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ArrayMaxSize,
  Min,
} from 'class-validator';

export class UpdateMissionDto {
  @ApiPropertyOptional({
    description: 'Title of the mission offer',
    example: 'Développeur Full Stack React/Node.js - Mise à jour',
    minLength: 3,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the mission',
    example: 'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js. Mission en télétravail possible.',
    minLength: 10,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Duration of the mission',
    example: '12 mois',
  })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({
    description: 'Budget allocated for the mission',
    example: 60000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Budget must be a number' })
  @Min(0, { message: 'Budget must be positive' })
  budget?: number;

  @ApiPropertyOptional({
    description: 'List of required skills (maximum 10)',
    example: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express', 'Docker'],
    type: [String],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray({ message: 'Skills must be an array' })
  @ArrayMaxSize(10, { message: 'Skills array cannot exceed 10 elements' })
  @IsString({ each: true, message: 'Each skill must be a string' })
  skills?: string[];
}


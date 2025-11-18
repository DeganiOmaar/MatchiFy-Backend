import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ArrayMaxSize,
  Min,
} from 'class-validator';

export class CreateMissionDto {
  @ApiProperty({
    description: 'Title of the mission offer',
    example: 'Développeur Full Stack React/Node.js',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiProperty({
    description: 'Detailed description of the mission',
    example: 'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js.',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiProperty({
    description: 'Duration of the mission',
    example: '6 mois',
  })
  @IsString()
  @IsNotEmpty({ message: 'Duration is required' })
  duration: string;

  @ApiProperty({
    description: 'Budget allocated for the mission',
    example: 50000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Budget must be a number' })
  @Min(0, { message: 'Budget must be positive' })
  @IsNotEmpty({ message: 'Budget is required' })
  budget: number;

  @ApiProperty({
    description: 'List of required skills',
    example: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express'],
    type: [String],
  })
  @IsArray({ message: 'Skills must be an array' })
  @IsString({ each: true, message: 'Each skill must be a string' })
  @IsNotEmpty({ message: 'Skills are required' })
  skills: string[];
}


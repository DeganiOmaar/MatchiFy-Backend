import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePortfolioDto {
  @ApiProperty({
    description: 'Title of the project',
    example: 'E-commerce Mobile App',
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiPropertyOptional({
    description: 'Role in the project (e.g., Lead Developer, Photographer)',
    example: 'Lead Developer',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'List of skills used in the project. Can be sent as JSON string or comma-separated string in multipart/form-data',
    example: ['React Native', 'Node.js', 'MongoDB'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value.split(',').map(s => s.trim()).filter(s => s);
      } catch {
        return value.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'A full-stack e-commerce mobile application with real-time inventory management.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}


import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateTalentProfileDto {
  @ApiPropertyOptional({
    description: 'Full name of the talent',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Email address (must be unique)',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Location/address',
    example: 'New York, USA',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Talent category (e.g., singer, designer, actor)',
    example: 'Singer',
  })
  @IsOptional()
  @IsString()
  talent?: string;

  @ApiPropertyOptional({
    description: 'Array of skills (maximum 10 items). Can be sent as JSON string or comma-separated string in multipart/form-data',
    example: ['Vocal Performance', 'Songwriting', 'Guitar'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value.split(',').map(s => s.trim()).filter(s => s);
      } catch {
        // If not JSON, treat as comma-separated string
        return value.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    return value;
  })
  @IsArray()
  @ArrayMaxSize(10, { message: 'Skills array cannot exceed 10 items' })
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Profile description or bio',
    example: 'Professional singer with 10 years of experience in live performances',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Portfolio website URL',
    example: 'https://johndoe-portfolio.com',
  })
  @IsOptional()
  @ValidateIf((o) => o.portfolioLink !== undefined && o.portfolioLink !== null && o.portfolioLink !== '')
  @IsUrl({}, { message: 'Please provide a valid URL for portfolio link' })
  portfolioLink?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Profile image file (PNG, JPG, JPEG only)',
  })
  @IsOptional()
  profileImage?: any;
}


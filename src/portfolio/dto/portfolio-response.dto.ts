import { ApiProperty } from '@nestjs/swagger';

export class PortfolioResponseDto {
  @ApiProperty({
    description: 'Portfolio project ID',
    example: '673ab2c3e8f9a1234567890d',
  })
  _id: string;

  @ApiProperty({
    description: 'Talent user ID who owns this project',
    example: '673ab2c3e8f9a1234567890c',
  })
  talentId: string;

  @ApiProperty({
    description: 'Project title',
    example: 'E-commerce Mobile App',
  })
  title: string;

  @ApiProperty({
    description: 'Role in the project',
    example: 'Lead Developer',
    required: false,
  })
  role?: string;

  @ApiProperty({
    description: 'Media file path (relative to base URL)',
    example: '/uploads/portfolio/project-1234567890.jpg',
    required: false,
  })
  media?: string;

  @ApiProperty({
    description: 'Media type (image or video)',
    example: 'image',
    enum: ['image', 'video'],
    required: false,
  })
  mediaType?: string;

  @ApiProperty({
    description: 'List of skills used in the project',
    example: ['React Native', 'Node.js', 'MongoDB'],
    type: [String],
  })
  skills: string[];

  @ApiProperty({
    description: 'Project description',
    example: 'A full-stack e-commerce mobile application.',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}


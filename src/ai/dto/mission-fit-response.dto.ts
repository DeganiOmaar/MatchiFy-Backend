import { ApiProperty } from '@nestjs/swagger';

export class RadarDataDto {
  @ApiProperty({
    description: 'Skills match score (0-100)',
    example: 85,
    minimum: 0,
    maximum: 100,
  })
  skillsMatch: number;

  @ApiProperty({
    description: 'Experience fit score (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  experienceFit: number;

  @ApiProperty({
    description: 'Project relevance score (0-100)',
    example: 80,
    minimum: 0,
    maximum: 100,
  })
  projectRelevance: number;

  @ApiProperty({
    description: 'Talent strength alignment score (0-100)',
    example: 90,
    minimum: 0,
    maximum: 100,
  })
  talentStrengthAlignment: number;

  @ApiProperty({
    description: 'Overall coherence score (0-100)',
    example: 82,
    minimum: 0,
    maximum: 100,
  })
  overallCoherence: number;
}

export class MissionFitResponseDto {
  @ApiProperty({
    description: 'Overall match score between talent and mission (0-100)',
    example: 82,
    minimum: 0,
    maximum: 100,
  })
  score: number;

  @ApiProperty({
    description: 'Radar chart data with 5 axes',
    type: RadarDataDto,
  })
  radar: RadarDataDto;

  @ApiProperty({
    description: 'Short summary of the mission fit analysis (2-3 lines)',
    example: 'This mission aligns well with your React and Node.js expertise. Your portfolio projects demonstrate strong full-stack capabilities that match the requirements. Consider highlighting your experience with TypeScript to strengthen your application.',
  })
  shortSummary: string;
}


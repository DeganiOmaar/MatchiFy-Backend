import {
  Controller,
  Post,
  Get,
  Request,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiProfileAnalyzerService } from './services/ai-profile-analyzer.service';
import { ProfileAnalysisResponseDto } from './dto/profile-analysis-response.dto';
import { ProfileAnalysisService } from './services/profile-analysis.service';
import { MissionFitAnalyzerService } from './services/mission-fit-analyzer.service';
import { MissionFitResponseDto } from './dto/mission-fit-response.dto';
import { ProposalGeneratorService } from './services/proposal-generator.service';
import { GenerateProposalDto, GenerateProposalResponseDto } from './dto/generate-proposal.dto';
import { Param, Body } from '@nestjs/common';

// Simple in-memory rate limiting
// In production, use Redis or a proper rate limiting library
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_REQUESTS_PER_DAY = 5; // Max 5 analyses per day per user

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();

  constructor(
    private readonly aiProfileAnalyzerService: AiProfileAnalyzerService,
    private readonly profileAnalysisService: ProfileAnalysisService,
    private readonly missionFitAnalyzerService: MissionFitAnalyzerService,
    private readonly proposalGeneratorService: ProposalGeneratorService,
  ) {
    // Clean up old rate limit entries every hour
    setInterval(() => this.cleanupRateLimit(), 60 * 60 * 1000);
  }

  @Post('profile-analysis')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Analyze talent profile with AI',
    description:
      'Analyzes the authenticated talent\'s profile using AI (Gemini) and returns structured feedback including summary, strengths, areas to improve, recommended tags, and a profile score. Rate limited to 5 analyses per day per user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile analysis completed successfully',
    type: ProfileAnalysisResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Rate limit exceeded or invalid request',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
  })
  @ApiResponse({
    status: 503,
    description: 'Service Unavailable - AI service is temporarily unavailable',
  })
  async analyzeProfile(@Request() req: any): Promise<ProfileAnalysisResponseDto> {
    const userId = req.user.id;
    const startTime = Date.now();

    // Check rate limit
    if (!this.checkRateLimit(userId)) {
      this.logger.warn(`Rate limit exceeded for user ${userId}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_DAY} analyses per day. Please try again tomorrow.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      this.logger.log(`Profile analysis requested by talent ${userId}`);
      const analysis = await this.aiProfileAnalyzerService.analyzeProfile(userId);

      // Get the saved analysis to include timestamp
      const savedAnalysis = await this.profileAnalysisService.findLatestByTalentId(userId);

      // Increment rate limit counter
      this.incrementRateLimit(userId);

      const duration = Date.now() - startTime;
      this.logger.log(`Profile analysis completed successfully for talent ${userId} in ${duration}ms`);

      return {
        ...analysis,
        analyzedAt: savedAnalysis?.createdAt || new Date(),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorStatus = error instanceof HttpException ? error.getStatus() : 'UNKNOWN';

      this.logger.error(
        `Profile analysis failed for talent ${userId} after ${duration}ms - Status: ${errorStatus} - Error: ${error.message}`,
        error.stack,
      );

      // Re-throw HTTP exceptions as-is (they already have user-friendly messages)
      if (error instanceof HttpException) {
        throw error;
      }

      // Map other errors to user-friendly messages
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to analyze profile. Please try again later.',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('profile-analysis')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get latest profile analysis',
    description:
      'Retrieves the most recent profile analysis for the authenticated talent without triggering a new analysis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Latest profile analysis retrieved successfully',
    type: ProfileAnalysisResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - No analysis found for this talent',
  })
  async getLatestAnalysis(@Request() req: any): Promise<ProfileAnalysisResponseDto> {
    const userId = req.user.id;

    const analysis = await this.profileAnalysisService.findLatestByTalentId(userId);

    if (!analysis) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'No profile analysis found. Please run an analysis first.',
          error: 'Not Found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      summary: analysis.summary,
      keyStrengths: analysis.keyStrengths,
      areasToImprove: analysis.areasToImprove,
      recommendedTags: analysis.recommendedTags,
      profileScore: analysis.profileScore,
      analyzedAt: analysis.createdAt,
    };
  }

  @Post('mission-fit/:missionId')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Analyze mission fit for talent',
    description:
      'Analyzes how well the authenticated talent profile matches a specific mission. Returns a match score, radar chart data with 5 axes, and a short summary. Uses cached results if talent and mission have not changed since last analysis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mission fit analysis completed successfully',
    type: MissionFitResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Mission not found or talent has no profile analysis',
  })
  @ApiResponse({
    status: 503,
    description: 'Service Unavailable - AI service is temporarily unavailable',
  })
  async analyzeMissionFit(
    @Request() req: any,
    @Param('missionId') missionId: string,
  ): Promise<MissionFitResponseDto> {
    const talentId = req.user.id;
    const startTime = Date.now();

    try {
      this.logger.log(
        `Mission fit analysis requested by talent ${talentId} for mission ${missionId}`,
      );
      const analysis = await this.missionFitAnalyzerService.analyzeMissionFit(
        talentId,
        missionId,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Mission fit analysis completed successfully for talent ${talentId} and mission ${missionId} in ${duration}ms`,
      );

      return analysis;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorStatus = error instanceof HttpException ? error.getStatus() : 'UNKNOWN';

      this.logger.error(
        `Mission fit analysis failed for talent ${talentId} and mission ${missionId} after ${duration}ms - Status: ${errorStatus} - Error: ${error.message}`,
        error.stack,
      );

      // Re-throw HTTP exceptions as-is (they already have user-friendly messages)
      if (error instanceof HttpException) {
        throw error;
      }

      // Map other errors to user-friendly messages
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to analyze mission fit. Please try again later.',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('proposals/generate')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate proposal content with AI',
    description:
      'Generates a professional proposal for a specific mission using AI. Uses talent profile, skills, portfolio, and mission details. Rate limited to prevent abuse.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proposal generated successfully',
    type: GenerateProposalResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid mission ID or rate limit exceeded',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Mission not found',
  })
  @ApiResponse({
    status: 503,
    description: 'Service Unavailable - AI service is temporarily unavailable',
  })
  async generateProposal(
    @Request() req: any,
    @Body() dto: GenerateProposalDto,
  ): Promise<GenerateProposalResponseDto> {
    const talentId = req.user.id;
    const startTime = Date.now();

    // Check rate limit (separate from profile analysis)
    const rateLimitKey = `proposal-gen-${talentId}`;
    if (!this.checkRateLimit(rateLimitKey)) {
      this.logger.warn(`Rate limit exceeded for proposal generation by talent ${talentId}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_DAY} proposal generations per day. Please try again tomorrow.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      this.logger.log(
        `Proposal generation requested by talent ${talentId} for mission ${dto.missionId}`,
      );
      const proposalContent =
        await this.proposalGeneratorService.generateProposalForMission(
          talentId,
          dto.missionId,
        );

      // Increment rate limit counter
      this.incrementRateLimit(rateLimitKey);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Proposal generation completed successfully for talent ${talentId} and mission ${dto.missionId} in ${duration}ms`,
      );

      return { proposalContent };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorStatus = error instanceof HttpException ? error.getStatus() : 'UNKNOWN';

      this.logger.error(
        `Proposal generation failed for talent ${talentId} and mission ${dto.missionId} after ${duration}ms - Status: ${errorStatus} - Error: ${error.message}`,
        error.stack,
      );

      // Re-throw HTTP exceptions as-is (they already have user-friendly messages)
      if (error instanceof HttpException) {
        throw error;
      }

      // Map other errors to user-friendly messages
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to generate proposal. Please try again later or write your proposal manually.',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Sse('proposals/generate/stream')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate proposal content with AI (streaming)',
    description:
      'Generates a professional proposal for a specific mission using AI with real-time streaming. Uses talent profile, skills, portfolio, and mission details. Streams the proposal content as it is generated. Rate limited to prevent abuse.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proposal streaming started',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid mission ID or rate limit exceeded',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Mission not found',
  })
  @ApiResponse({
    status: 503,
    description: 'Service Unavailable - AI service is temporarily unavailable',
  })
  generateProposalStream(
    @Request() req: any,
  ): any {
    const talentId = req.user.id;
    const missionId = req.query.missionId;

    if (!missionId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'missionId query parameter is required',
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const startTime = Date.now();

    // Check rate limit (separate from profile analysis)
    const rateLimitKey = `proposal-gen-${talentId}`;
    if (!this.checkRateLimit(rateLimitKey)) {
      this.logger.warn(`Rate limit exceeded for proposal generation by talent ${talentId}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_DAY} proposal generations per day. Please try again tomorrow.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.log(
      `Streaming proposal generation requested by talent ${talentId} for mission ${missionId}`,
    );

    // Import Observable and Subject from rxjs
    const { Observable } = require('rxjs');

    return new Observable((observer) => {
      // Generate proposal with streaming
      this.proposalGeneratorService
        .generateProposalForMissionStream(
          talentId,
          missionId,
          (chunk: string) => {
            // Send each chunk as an SSE event
            observer.next({ data: { chunk } });
          },
        )
        .then((finalProposal) => {
          // Increment rate limit counter after successful generation
          this.incrementRateLimit(rateLimitKey);

          const duration = Date.now() - startTime;
          this.logger.log(
            `Streaming proposal generation completed successfully for talent ${talentId} and mission ${missionId} in ${duration}ms`,
          );

          // Send final event with DONE marker
          observer.next({ data: { done: true, proposalContent: finalProposal } });
          observer.complete();
        })
        .catch((error: any) => {
          const duration = Date.now() - startTime;
          const errorStatus = error instanceof HttpException ? error.getStatus() : 'UNKNOWN';

          this.logger.error(
            `Streaming proposal generation failed for talent ${talentId} and mission ${missionId} after ${duration}ms - Status: ${errorStatus} - Error: ${error.message}`,
            error.stack,
          );

          // Send error event
          observer.next({
            data: {
              error: true,
              message:
                error instanceof HttpException
                  ? error.message
                  : 'Failed to generate proposal. Please try again later or write your proposal manually.',
            },
          });
          observer.error(error);
        });
    });
  }

  /**
   * Check if user has exceeded rate limit
   */
  private checkRateLimit(userId: string): boolean {
    const entry = this.rateLimitMap.get(userId);

    if (!entry) {
      return true; // No previous requests
    }

    // Check if window has expired
    if (Date.now() > entry.resetAt) {
      this.rateLimitMap.delete(userId);
      return true;
    }

    // Check if limit exceeded
    return entry.count < MAX_REQUESTS_PER_DAY;
  }

  /**
   * Increment rate limit counter
   */
  private incrementRateLimit(userId: string): void {
    const entry = this.rateLimitMap.get(userId);

    if (entry && Date.now() <= entry.resetAt) {
      entry.count++;
    } else {
      // Create new entry or reset expired one
      this.rateLimitMap.set(userId, {
        count: 1,
        resetAt: Date.now() + RATE_LIMIT_WINDOW,
      });
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimit(): void {
    const now = Date.now();
    for (const [userId, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        this.rateLimitMap.delete(userId);
      }
    }
  }
}


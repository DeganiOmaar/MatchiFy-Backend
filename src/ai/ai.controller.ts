import {
  Controller,
  Post,
  Get,
  Request,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
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


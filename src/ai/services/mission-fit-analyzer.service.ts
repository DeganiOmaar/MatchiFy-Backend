import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiService } from './ai.service';
import { UserService } from '../../user/user.service';
import { UserDocument } from '../../user/schemas/user.schema';
import { MissionsService } from '../../missions/missions.service';
import { MissionDocument } from '../../missions/schemas/mission.schema';
import { ProfileAnalysisService } from './profile-analysis.service';
import {
  MissionFitAnalysis,
  MissionFitAnalysisDocument,
} from '../schemas/mission-fit-analysis.schema';
import { MissionFitResponseDto } from '../dto/mission-fit-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class MissionFitAnalyzerService {
  private readonly logger = new Logger(MissionFitAnalyzerService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => MissionsService))
    private readonly missionsService: MissionsService,
    private readonly profileAnalysisService: ProfileAnalysisService,
    @InjectModel(MissionFitAnalysis.name)
    private missionFitAnalysisModel: Model<MissionFitAnalysisDocument>,
  ) {}

  /**
   * Analyze mission fit for a talent
   */
  async analyzeMissionFit(
    talentId: string,
    missionId: string,
  ): Promise<MissionFitResponseDto> {
    if (!this.aiService.isAvailable()) {
      throw new ServiceUnavailableException(
        'AI service is not available. Please check configuration.',
      );
    }

    // Check if talent has profile analysis
    const profileAnalysis = await this.profileAnalysisService.findLatestByTalentId(talentId);
    if (!profileAnalysis) {
      throw new NotFoundException(
        'No profile analysis found. Please run profile analysis first.',
      );
    }

    // Load talent and mission data
    const talent = await this.userService.findById(talentId);
    if (!talent) {
      throw new NotFoundException('Talent not found');
    }

    const mission = await this.missionsService.findOne(missionId);
    if (!mission) {
      throw new NotFoundException('Mission not found');
    }

    // Compute hashes for cache checking
    const talentHash = this.computeTalentHash(talent, profileAnalysis);
    const missionHash = this.computeMissionHash(mission);

    // Check for cached analysis
    const cachedAnalysis = await this.missionFitAnalysisModel.findOne({
      talentId,
      missionId,
    });

    if (cachedAnalysis) {
      // Check if cache is still valid
      const talentDoc = talent as UserDocument;
      const missionDoc = mission as MissionDocument;
      const talentUpdated = talentDoc.updatedAt ? new Date(talentDoc.updatedAt) : new Date();
      const missionUpdated = missionDoc.updatedAt ? new Date(missionDoc.updatedAt) : new Date();
      const cacheTalentUpdated = new Date(cachedAnalysis.talentUpdatedAt);
      const cacheMissionUpdated = new Date(cachedAnalysis.missionUpdatedAt);

      const talentChanged =
        talentHash !== cachedAnalysis.talentHash ||
        talentUpdated > cacheTalentUpdated;
      const missionChanged =
        missionHash !== cachedAnalysis.missionHash ||
        missionUpdated > cacheMissionUpdated;

      if (!talentChanged && !missionChanged) {
        this.logger.debug(
          `Using cached mission fit analysis for talent ${talentId} and mission ${missionId}`,
        );
        return {
          score: cachedAnalysis.score,
          radar: cachedAnalysis.radar,
          shortSummary: cachedAnalysis.shortSummary,
        };
      }

      this.logger.debug(
        `Cache invalidated for talent ${talentId} and mission ${missionId}. Recomputing...`,
      );
    }

    // Generate prompt
    const prompt = this.buildMissionFitPrompt(talent, profileAnalysis, mission);

    // Call AI service
    this.logger.log(
      `Analyzing mission fit for talent ${talentId} and mission ${missionId}`,
    );
    const startTime = Date.now();

    let analysis;
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      try {
        analysis = await this.aiService.generateJsonContent(prompt, 1);
        break; // Success, exit retry loop
      } catch (error) {
        if (retries >= maxRetries) {
          this.logger.error(
            `Failed to generate mission fit analysis after ${retries + 1} attempts: ${error.message}`,
          );
          throw new ServiceUnavailableException(
            'Failed to generate mission fit analysis. Please try again later.',
          );
        }
        retries++;
        this.logger.warn(
          `Retry ${retries} for mission fit analysis generation`,
        );
      }
    }

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `Mission fit analysis completed in ${elapsed}ms for talent ${talentId} and mission ${missionId}`,
    );

    // Validate and normalize response
    const normalizedAnalysis = this.normalizeMissionFitResponse(analysis);

    // Save to database (upsert)
    const talentDoc = talent as UserDocument;
    const missionDoc = mission as MissionDocument;
    await this.missionFitAnalysisModel.findOneAndUpdate(
      { talentId, missionId },
      {
        talentId,
        missionId,
        score: normalizedAnalysis.score,
        radar: normalizedAnalysis.radar,
        shortSummary: normalizedAnalysis.shortSummary,
        talentHash,
        missionHash,
        talentUpdatedAt: talentDoc.updatedAt || new Date(),
        missionUpdatedAt: missionDoc.updatedAt || new Date(),
      },
      { upsert: true, new: true },
    );

    return normalizedAnalysis;
  }

  /**
   * Build the mission fit analysis prompt
   */
  private buildMissionFitPrompt(
    talent: any,
    profileAnalysis: any,
    mission: any,
  ): string {
    const parts: string[] = [];

    parts.push(
      'You are an expert career advisor analyzing how well a talent profile matches a specific mission opportunity.',
    );
    parts.push('');
    parts.push('Analyze the following talent profile and mission requirements:');
    parts.push('');
    parts.push('=== TALENT PROFILE ===');
    parts.push(`Name: ${talent.fullName || 'Unknown'}`);
    parts.push(`Summary: ${profileAnalysis.summary || 'No summary available'}`);
    parts.push('');
    parts.push(`Key Strengths: ${profileAnalysis.keyStrengths?.join(', ') || 'None listed'}`);
    parts.push('');
    parts.push(
      `Recommended Tags: ${profileAnalysis.recommendedTags?.join(', ') || 'None'}`,
    );
    parts.push('');
    parts.push(`Skills: ${talent.skills?.join(', ') || 'None listed'}`);
    parts.push('');
    parts.push('=== MISSION REQUIREMENTS ===');
    parts.push(`Title: ${mission.title || 'Unknown'}`);
    parts.push(`Description: ${mission.description || 'No description'}`);
    parts.push(`Required Skills: ${mission.skills?.join(', ') || 'None specified'}`);
    parts.push('');
    parts.push(
      'Provide your analysis in the following JSON format (ONLY JSON, no other text):',
    );
    parts.push('{');
    parts.push('  "score": 82,');
    parts.push('  "radar": {');
    parts.push('    "skillsMatch": 85,');
    parts.push('    "experienceFit": 75,');
    parts.push('    "projectRelevance": 80,');
    parts.push('    "talentStrengthAlignment": 90,');
    parts.push('    "overallCoherence": 82');
    parts.push('  },');
    parts.push('  "shortSummary": "2-3 lines summary here"');
    parts.push('}');
    parts.push('');
    parts.push('Guidelines:');
    parts.push(
      '- score: Overall match score (0-100) considering all factors',
    );
    parts.push(
      '- radar.skillsMatch: How well talent skills match mission requirements (0-100)',
    );
    parts.push(
      '- radar.experienceFit: How well talent experience aligns with mission needs (0-100)',
    );
    parts.push(
      '- radar.projectRelevance: Relevance of talent portfolio to mission (0-100)',
    );
    parts.push(
      '- radar.talentStrengthAlignment: How mission leverages talent key strengths (0-100)',
    );
    parts.push(
      '- radar.overallCoherence: Overall coherence and fit between talent and mission (0-100)',
    );
    parts.push(
      '- shortSummary: 2-3 lines only, highlighting key match points and any gaps',
    );
    parts.push('');
    parts.push(
      'Be specific, constructive, and professional. Base scores on actual data provided.',
    );

    return parts.join('\n');
  }

  /**
   * Normalize and validate mission fit response
   */
  private normalizeMissionFitResponse(analysis: any): MissionFitResponseDto {
    // Ensure score is valid
    const score = this.normalizeScore(analysis.score);

    // Ensure radar object exists with all 5 axes
    const radar = {
      skillsMatch: this.normalizeScore(
        analysis.radar?.skillsMatch ?? analysis.skillsMatch ?? 0,
      ),
      experienceFit: this.normalizeScore(
        analysis.radar?.experienceFit ?? analysis.experienceFit ?? 0,
      ),
      projectRelevance: this.normalizeScore(
        analysis.radar?.projectRelevance ?? analysis.projectRelevance ?? 0,
      ),
      talentStrengthAlignment: this.normalizeScore(
        analysis.radar?.talentStrengthAlignment ??
          analysis.talentStrengthAlignment ??
          0,
      ),
      overallCoherence: this.normalizeScore(
        analysis.radar?.overallCoherence ?? analysis.overallCoherence ?? 0,
      ),
    };

    // Ensure shortSummary exists
    const shortSummary =
      typeof analysis.shortSummary === 'string' &&
      analysis.shortSummary.trim()
        ? analysis.shortSummary.trim()
        : 'Mission fit analysis completed.';

    return {
      score,
      radar,
      shortSummary,
    };
  }

  /**
   * Normalize score to 0-100 range
   */
  private normalizeScore(score: any): number {
    if (typeof score === 'number') {
      return Math.max(0, Math.min(100, Math.round(score)));
    }

    if (typeof score === 'string') {
      const parsed = parseFloat(score);
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }

    // Default score if invalid
    return 50;
  }

  /**
   * Compute hash of talent profile for change detection
   */
  private computeTalentHash(talent: any, profileAnalysis: any): string {
    const hashInput = JSON.stringify({
      fullName: talent.fullName,
      skills: (talent.skills || []).sort(),
      summary: profileAnalysis.summary,
      keyStrengths: (profileAnalysis.keyStrengths || []).sort(),
      recommendedTags: (profileAnalysis.recommendedTags || []).sort(),
    });

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Compute hash of mission for change detection
   */
  private computeMissionHash(mission: any): string {
    const hashInput = JSON.stringify({
      title: mission.title,
      description: mission.description,
      skills: (mission.skills || []).sort(),
    });

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }
}


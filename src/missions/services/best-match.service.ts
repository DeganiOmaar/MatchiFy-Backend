import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Mission, MissionDocument } from '../schemas/mission.schema';
import {
  MissionRankingCache,
  MissionRankingCacheDocument,
} from '../schemas/mission-ranking-cache.schema';
import { ProfileAnalysisService } from '../../ai/services/profile-analysis.service';
import { AiService } from '../../ai/services/ai.service';

export interface BestMatchMission {
  missionId: string;
  title: string;
  description: string;
  duration: string;
  budget: number;
  skills: string[];
  recruiterId: string;
  matchScore: number;
  reasoning: string;
}

@Injectable()
export class BestMatchService {
  private readonly logger = new Logger(BestMatchService.name);
  private readonly CACHE_DURATION_HOURS = 12;

  constructor(
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    @InjectModel(MissionRankingCache.name)
    private cacheModel: Model<MissionRankingCacheDocument>,
    private readonly profileAnalysisService: ProfileAnalysisService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Get best match missions for a talent
   * Uses cached results if available and valid
   */
  async getBestMatches(talentId: string): Promise<BestMatchMission[]> {
    // Check cache first
    const cached = await this.getCachedRankings(talentId);
    if (cached) {
      this.logger.debug(`Using cached rankings for talent ${talentId}`);
      return cached;
    }

    // If no cache, compute rankings (async, don't block)
    this.refreshRankings(talentId).catch((error) => {
      this.logger.error(
        `Failed to refresh rankings for talent ${talentId}: ${error.message}`,
        error.stack,
      );
    });

    // Return empty array if no cache (will be populated on next request)
    return [];
  }

  /**
   * Refresh rankings for a talent (async background process)
   */
  async refreshRankings(talentId: string): Promise<BestMatchMission[]> {
    this.logger.log(`Refreshing rankings for talent ${talentId}`);

    // Load latest profile analysis
    const profileAnalysis = await this.profileAnalysisService.findLatestByTalentId(
      talentId,
    );

    if (!profileAnalysis) {
      this.logger.warn(
        `No profile analysis found for talent ${talentId}. Cannot compute best matches.`,
      );
      return [];
    }

    // Load all missions
    const missions = await this.missionModel.find().exec();

    if (missions.length === 0) {
      this.logger.debug(`No missions found in database`);
      return [];
    }

    // Score all missions
    const scoredMissions = await this.scoreMissions(
      missions,
      profileAnalysis,
    );

    // Sort by matchScore descending and take top 20
    const topMatches = scoredMissions
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20);

    // Cache results
    await this.cacheRankings(talentId, topMatches);

    this.logger.log(
      `Rankings refreshed for talent ${talentId}: ${topMatches.length} matches found`,
    );

    return topMatches;
  }

  /**
   * Score all missions using Ollama
   */
  private async scoreMissions(
    missions: MissionDocument[],
    profileAnalysis: any,
  ): Promise<BestMatchMission[]> {
    const scoredMissions: BestMatchMission[] = [];

    // Build prompt components from profile analysis
    const profileSummary = profileAnalysis.summary || '';
    const keyStrengths = profileAnalysis.keyStrengths?.join(', ') || '';
    const recommendedTags = profileAnalysis.recommendedTags?.join(', ') || '';

    // Score missions in parallel (with concurrency limit to avoid overwhelming Ollama)
    const CONCURRENCY_LIMIT = 5;
    for (let i = 0; i < missions.length; i += CONCURRENCY_LIMIT) {
      const batch = missions.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map((mission) =>
          this.scoreSingleMission(mission, {
            summary: profileSummary,
            keyStrengths,
            recommendedTags,
          }),
        ),
      );

      scoredMissions.push(...batchResults.filter((r) => r !== null));
    }

    return scoredMissions;
  }

  /**
   * Score a single mission using Ollama
   */
  private async scoreSingleMission(
    mission: MissionDocument,
    profileData: {
      summary: string;
      keyStrengths: string;
      recommendedTags: string;
    },
  ): Promise<BestMatchMission | null> {
    try {
      const prompt = this.buildRankingPrompt(mission, profileData);

      const response = await this.aiService.generateJsonContent(prompt, 1);

      // Validate response
      if (
        !response ||
        typeof response.matchScore !== 'number' ||
        typeof response.reasoning !== 'string'
      ) {
        this.logger.warn(
          `Invalid response from AI for mission ${mission._id}`,
        );
        return null;
      }

      // Ensure matchScore is in valid range
      const matchScore = Math.max(0, Math.min(100, Math.round(response.matchScore)));

      return {
        missionId: String(mission._id),
        title: mission.title,
        description: mission.description,
        duration: mission.duration,
        budget: mission.budget,
        skills: mission.skills,
        recruiterId: String(mission.recruiterId),
        matchScore,
        reasoning: response.reasoning.trim().substring(0, 200), // Limit reasoning length
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to score mission ${mission._id}: ${error.message}`,
      );
      // Return null to skip this mission
      return null;
    }
  }

  /**
   * Build ranking prompt for Ollama
   */
  private buildRankingPrompt(
    mission: MissionDocument,
    profileData: {
      summary: string;
      keyStrengths: string;
      recommendedTags: string;
    },
  ): string {
    const parts: string[] = [];

    parts.push(
      'You are an expert recruiter matching talents with mission opportunities.',
    );
    parts.push('');
    parts.push(
      'Analyze how well this talent profile matches the following mission and return a JSON response with a match score (0-100) and a short reasoning.',
    );
    parts.push('');
    parts.push('=== TALENT PROFILE ===');
    parts.push(`Summary: ${profileData.summary}`);
    parts.push(`Key Strengths: ${profileData.keyStrengths}`);
    parts.push(`Recommended Tags: ${profileData.recommendedTags}`);
    parts.push('');
    parts.push('=== MISSION ===');
    parts.push(`Title: ${mission.title}`);
    parts.push(`Description: ${mission.description}`);
    parts.push(`Skills Required: ${mission.skills.join(', ')}`);
    parts.push(`Duration: ${mission.duration}`);
    parts.push(`Budget: ${mission.budget} €`);
    parts.push('');
    parts.push(
      'Provide your analysis in the following JSON format (ONLY JSON, no other text):',
    );
    parts.push('{');
    parts.push('  "matchScore": 75,');
    parts.push('  "reasoning": "Short explanation of the match (1-2 lines)"');
    parts.push('}');
    parts.push('');
    parts.push('Guidelines:');
    parts.push(
      '- matchScore: A number between 0-100 indicating how well the talent matches the mission',
    );
    parts.push(
      '  * Consider: skills alignment, experience relevance, profile completeness',
    );
    parts.push(
      '  * Higher scores for strong skill matches and relevant experience',
    );
    parts.push(
      '  * Lower scores for weak or no skill matches, or irrelevant experience',
    );
    parts.push(
      '- reasoning: A concise 1-2 line explanation of why this is a good or poor match',
    );
    parts.push(
      'Be specific and professional. Focus on concrete matches between talent strengths and mission requirements.',
    );

    return parts.join('\n');
  }

  /**
   * Get cached rankings if available and valid
   */
  private async getCachedRankings(
    talentId: string,
  ): Promise<BestMatchMission[] | null> {
    const cache = await this.cacheModel
      .findOne({
        talentId,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .exec();

    if (!cache) {
      return null;
    }

    // Convert cache to BestMatchMission format
    // We need to fetch mission details from database
    const missionIds = cache.rankings.map((r) => r.missionId);
    const missions = await this.missionModel
      .find({ _id: { $in: missionIds } })
      .exec();

    const missionMap = new Map(
      missions.map((m) => [String(m._id), m]),
    );

    return cache.rankings
      .map((ranking) => {
        // Try to get mission from database first (most up-to-date)
        const mission = missionMap.get(ranking.missionId);
        if (mission) {
          return {
            missionId: ranking.missionId,
            title: mission.title,
            description: mission.description,
            duration: mission.duration,
            budget: mission.budget,
            skills: mission.skills,
            recruiterId: String(mission.recruiterId),
            matchScore: ranking.matchScore,
            reasoning: ranking.reasoning,
          };
        }
        // Fallback to cached data if mission not found in database
        if (ranking.title && ranking.description) {
          return {
            missionId: ranking.missionId,
            title: ranking.title,
            description: ranking.description,
            duration: ranking.duration || '',
            budget: ranking.budget || 0,
            skills: ranking.skills || [],
            recruiterId: ranking.recruiterId || '',
            matchScore: ranking.matchScore,
            reasoning: ranking.reasoning,
          };
        }
        return null;
      })
      .filter((m): m is BestMatchMission => m !== null);
  }

  /**
   * Cache rankings for a talent
   */
  private async cacheRankings(
    talentId: string,
    rankings: BestMatchMission[],
  ): Promise<void> {
    // Delete old cache entries for this talent
    await this.cacheModel.deleteMany({ talentId }).exec();

    // Create new cache entry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.CACHE_DURATION_HOURS);

    const cacheData = {
      talentId,
      rankings: rankings.map((r) => ({
        missionId: r.missionId,
        matchScore: r.matchScore,
        reasoning: r.reasoning,
        // Store additional mission data for faster retrieval
        title: r.title,
        description: r.description,
        duration: r.duration,
        budget: r.budget,
        skills: r.skills,
        recruiterId: r.recruiterId,
      })),
      expiresAt,
    };

    await this.cacheModel.create(cacheData);
  }
}


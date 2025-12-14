import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OllamaService } from './ollama.service';
import { UserService } from '../../user/user.service';
import { MissionsService } from '../../missions/missions.service';
import { ProfileAnalysisService } from './profile-analysis.service';
import { Proposal, ProposalDocument } from '../../proposals/schemas/proposal.schema';
import * as crypto from 'crypto';

interface ProposalMatchScore {
  proposalId: string;
  talentId: string;
  score: number;
  computedAt: Date;
}

interface FallbackScoreResult {
  score: number;
  usedFallback: true;
}

@Injectable()
export class AiProposalMatchService {
  private readonly logger = new Logger(AiProposalMatchService.name);
  private readonly scoreCache = new Map<string, ProposalMatchScore>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => MissionsService))
    private readonly missionsService: MissionsService,
    private readonly profileAnalysisService: ProfileAnalysisService,
    @InjectModel(Proposal.name)
    private readonly proposalModel: Model<ProposalDocument>,
  ) {}

  /**
   * Score a single proposal's compatibility with its mission
   * Returns a score from 0-100
   */
  async scoreProposal(
    proposalId: string,
    missionId: string,
    talentId: string,
  ): Promise<number> {
    // Check cache first
    const cacheKey = this.getCacheKey(proposalId, missionId, talentId);
    const cached = this.scoreCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.computedAt)) {
      this.logger.debug(`Using cached score for proposal ${proposalId}`);
      return cached.score;
    }

    // Check database cache
    const proposal = await this.proposalModel.findById(proposalId).exec();
    if (
      proposal?.aiScore !== undefined &&
      proposal.aiScoreComputedAt &&
      this.isCacheValid(proposal.aiScoreComputedAt)
    ) {
      this.logger.debug(`Using DB cached score for proposal ${proposalId}`);
      const score = proposal.aiScore;
      this.scoreCache.set(cacheKey, {
        proposalId,
        talentId,
        score,
        computedAt: proposal.aiScoreComputedAt,
      });
      return score;
    }

    // Compute new score
    try {
      const score = await this.computeScore(missionId, talentId, proposalId);
      
      // Cache in memory
      this.scoreCache.set(cacheKey, {
        proposalId,
        talentId,
        score,
        computedAt: new Date(),
      });

      // Cache in database
      await this.proposalModel.findByIdAndUpdate(proposalId, {
        aiScore: score,
        aiScoreComputedAt: new Date(),
      });

      return score;
    } catch (error) {
      this.logger.error(`Failed to score proposal ${proposalId}: ${error.message}`);
      // Return fallback score
      const fallbackResult = await this.computeFallbackScore(missionId, talentId);
      return fallbackResult.score;
    }
  }

  /**
   * Score multiple proposals for a mission
   * Returns proposals sorted by score (highest first)
   */
  async scoreProposalsForMission(
    missionId: string,
    proposals: any[],
  ): Promise<any[]> {
    const scoredProposals = await Promise.all(
      proposals.map(async (proposal) => {
        const score = await this.scoreProposal(
          proposal._id.toString(),
          missionId,
          proposal.talentId,
        );
        return {
          ...proposal,
          aiScore: score,
        };
      }),
    );

    // Sort by score descending
    return scoredProposals.sort((a, b) => b.aiScore - a.aiScore);
  }

  /**
   * Compute AI compatibility score using Ollama
   */
  private async computeScore(
    missionId: string,
    talentId: string,
    proposalId: string,
  ): Promise<number> {
    if (!this.ollamaService.isAvailable()) {
      this.logger.warn('Ollama service not available, using fallback scoring');
      const fallback = await this.computeFallbackScore(missionId, talentId);
      return fallback.score;
    }

    // Load mission data
    const mission = await this.missionsService.findOne(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }

    // Load talent data
    const talent = await this.userService.findById(talentId);
    if (!talent) {
      throw new Error(`Talent ${talentId} not found`);
    }

    // Load proposal data
    const proposal = await this.proposalModel.findById(proposalId).exec();
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Load profile analysis if available
    const profileAnalysis = await this.profileAnalysisService.findLatestByTalentId(talentId);

    // Build prompt
    const prompt = this.buildScoringPrompt(mission, talent, proposal, profileAnalysis);

    // Call Ollama
    this.logger.log(`Computing AI score for proposal ${proposalId}`);
    const startTime = Date.now();

    try {
      const response = await this.ollamaService.generateContent(prompt, {
        temperature: 0.3, // Lower temperature for more consistent scoring
        maxTokens: 500,
      });

      const elapsed = Date.now() - startTime;
      this.logger.log(`AI scoring completed in ${elapsed}ms for proposal ${proposalId}`);

      // Parse JSON response
      const result = this.parseAiResponse(response.text);
      return this.normalizeScore(result.score);
    } catch (error) {
      this.logger.error(`AI scoring failed: ${error.message}`);
      const fallback = await this.computeFallbackScore(missionId, talentId);
      return fallback.score;
    }
  }

  /**
   * Build the AI scoring prompt
   */
  private buildScoringPrompt(
    mission: any,
    talent: any,
    proposal: any,
    profileAnalysis: any,
  ): string {
    const parts: string[] = [];

    parts.push('You are an expert recruiter evaluating how well a talent matches a mission opportunity.');
    parts.push('');
    parts.push('Analyze the following information and provide a compatibility score from 0-100.');
    parts.push('');
    parts.push('=== MISSION REQUIREMENTS ===');
    parts.push(`Title: ${mission.title || 'Unknown'}`);
    parts.push(`Description: ${mission.description || 'No description'}`);
    parts.push(`Required Skills: ${mission.skills?.join(', ') || 'None specified'}`);
    parts.push(`Budget: ${mission.budget || 'Not specified'}`);
    parts.push(`Duration: ${mission.duration || 'Not specified'}`);
    parts.push('');
    parts.push('=== TALENT PROFILE ===');
    parts.push(`Name: ${talent.fullName || 'Unknown'}`);
    parts.push(`Main Talent: ${talent.talent || 'Not specified'}`);
    parts.push(`Skills: ${talent.skills?.join(', ') || 'None listed'}`);
    parts.push(`Description: ${talent.description || 'No description'}`);
    parts.push(`CV URL: ${talent.cvUrl ? 'Available' : 'Not available'}`);
    parts.push('');
    
    if (profileAnalysis) {
      parts.push('=== AI PROFILE ANALYSIS ===');
      parts.push(`Summary: ${profileAnalysis.summary || 'No summary'}`);
      parts.push(`Key Strengths: ${profileAnalysis.keyStrengths?.join(', ') || 'None'}`);
      parts.push(`Profile Score: ${profileAnalysis.score || 'N/A'}/100`);
      parts.push('');
    }

    parts.push('=== PROPOSAL ===');
    parts.push(`Message: ${proposal.message || 'No message'}`);
    parts.push(`Proposal Content: ${proposal.proposalContent || 'No content'}`);
    parts.push(`Proposed Budget: ${proposal.proposedBudget || 'Not specified'}`);
    parts.push(`Estimated Duration: ${proposal.estimatedDuration || 'Not specified'}`);
    parts.push('');
    parts.push('CRITICAL: Respond with ONLY valid JSON in this exact format:');
    parts.push('{ "score": 85 }');
    parts.push('');
    parts.push('Scoring Guidelines (0-100):');
    parts.push('- 90-100: Perfect match - talent has all required skills and highly relevant experience');
    parts.push('- 75-89: Strong match - talent has most required skills and good experience');
    parts.push('- 60-74: Good match - talent has some required skills and relevant experience');
    parts.push('- 40-59: Moderate match - talent has basic skills but may lack experience');
    parts.push('- 20-39: Weak match - talent has few required skills');
    parts.push('- 0-19: Poor match - talent lacks most required skills');
    parts.push('');
    parts.push('Consider:');
    parts.push('1. Skill overlap between talent and mission requirements (40% weight)');
    parts.push('2. Relevance of talent experience to mission needs (30% weight)');
    parts.push('3. Quality of the proposal content and professionalism (20% weight)');
    parts.push('4. Overall profile quality from AI analysis if available (10% weight)');

    return parts.join('\n');
  }

  /**
   * Parse AI response and extract score
   */
  private parseAiResponse(content: string): { score: number } {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(content);
      if (typeof parsed.score === 'number') {
        return parsed;
      }
    } catch (e) {
      // Try to extract score from text
      const match = content.match(/"score"\s*:\s*(\d+)/);
      if (match) {
        return { score: parseInt(match[1], 10) };
      }
    }

    throw new Error('Failed to parse AI response');
  }

  /**
   * Fallback scoring based on skill overlap
   */
  private async computeFallbackScore(
    missionId: string,
    talentId: string,
  ): Promise<FallbackScoreResult> {
    this.logger.debug(`Computing fallback score for talent ${talentId} and mission ${missionId}`);

    const mission = await this.missionsService.findOne(missionId);
    const talent = await this.userService.findById(talentId);

    if (!mission || !talent) {
      return { score: 50, usedFallback: true }; // Default middle score
    }

    const missionSkills = mission.skills || [];
    const talentSkills = talent.skills || [];

    if (missionSkills.length === 0) {
      return { score: 60, usedFallback: true }; // Slightly above average if no skills required
    }

    // Calculate skill overlap
    const matchingSkills = talentSkills.filter((skill: string) =>
      missionSkills.some((mSkill: string) =>
        skill.toLowerCase().includes(mSkill.toLowerCase()) ||
        mSkill.toLowerCase().includes(skill.toLowerCase())
      )
    );

    const overlapRatio = matchingSkills.length / missionSkills.length;
    
    // Convert to 0-100 scale with some base score
    const baseScore = 30; // Minimum score for submitting a proposal
    const skillScore = Math.round(baseScore + (overlapRatio * 70));

    return { score: Math.min(100, Math.max(0, skillScore)), usedFallback: true };
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
    return 50; // Default middle score
  }

  /**
   * Check if cached score is still valid
   */
  private isCacheValid(computedAt: Date): boolean {
    const now = new Date();
    const age = now.getTime() - new Date(computedAt).getTime();
    return age < this.CACHE_TTL_MS;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(proposalId: string, missionId: string, talentId: string): string {
    return crypto
      .createHash('sha256')
      .update(`${proposalId}-${missionId}-${talentId}`)
      .digest('hex');
  }

  /**
   * Clear expired cache entries (called periodically)
   */
  clearExpiredCache(): void {
    const now = new Date();
    for (const [key, value] of this.scoreCache.entries()) {
      if (!this.isCacheValid(value.computedAt)) {
        this.scoreCache.delete(key);
      }
    }
    this.logger.debug(`Cleared expired cache entries. Current size: ${this.scoreCache.size}`);
  }
}

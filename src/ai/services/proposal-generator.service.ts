import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { UserService } from '../../user/user.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { SkillService } from '../../skill/skill.service';
import { ProfileAnalysisService } from './profile-analysis.service';
import { MissionsService } from '../../missions/missions.service';
import * as fs from 'fs/promises';
import * as path from 'path';
const { PDFParse } = require('pdf-parse');

@Injectable()
export class ProposalGeneratorService {
  private readonly logger = new Logger(ProposalGeneratorService.name);
  private readonly MIN_PROPOSAL_LENGTH = 200;

  constructor(
    private readonly aiService: AiService,
    private readonly userService: UserService,
    private readonly portfolioService: PortfolioService,
    private readonly skillService: SkillService,
    private readonly profileAnalysisService: ProfileAnalysisService,
    private readonly missionsService: MissionsService,
  ) {}

  /**
   * Generate a professional proposal for a mission using AI
   */
  async generateProposalForMission(
    talentId: string,
    missionId: string,
  ): Promise<string> {
    try {
      // Load mission details
      const mission = await this.missionsService.findOne(missionId);
      if (!mission) {
        throw new NotFoundException(`Mission ${missionId} not found`);
      }

      // Load talent profile data
      const talent = await this.userService.findById(talentId);
      if (!talent || talent.role !== 'talent') {
        throw new NotFoundException(`Talent ${talentId} not found`);
      }

      // Get talent skills
      const skillNames: string[] = [];
      if (talent.skills && talent.skills.length > 0) {
        const skills = await this.skillService.findByIds(talent.skills);
        skillNames.push(...skills.map((s) => s.name));
      }

      // Get portfolio projects
      const portfolioProjects = await this.portfolioService.findAllByTalent(
        talentId,
      );
      const projectSummaries = portfolioProjects
        .slice(0, 5) // Limit to top 5 projects
        .map((p) => ({
          title: p.title,
          description: p.description || '',
          role: p.role || '',
        }));

      // Get profile analysis if available
      const profileAnalysis =
        await this.profileAnalysisService.findLatestByTalentId(talentId);

      // Get CV text if available
      let cvText = '';
      if (talent.cvUrl) {
        try {
          cvText = await this.extractCvText(talent.cvUrl);
        } catch (error) {
          this.logger.warn(
            `Failed to extract CV text for talent ${talentId}: ${error.message}`,
          );
        }
      }

      // Build prompt
      const prompt = this.buildProposalPrompt(
        mission,
        {
          name: talent.fullName,
          headline: talent.description || '',
          skills: skillNames,
          projects: projectSummaries,
          profileAnalysis: profileAnalysis
            ? {
                summary: profileAnalysis.summary,
                keyStrengths: profileAnalysis.keyStrengths,
              }
            : null,
          cvText,
        },
      );

      // Generate proposal using AI
      const response = await this.aiService.generateContent(prompt, {
        temperature: 0.7,
        maxTokens: 2000,
      });

      let proposalText = response.text.trim();

      // Ensure minimum length
      if (proposalText.length < this.MIN_PROPOSAL_LENGTH) {
        this.logger.warn(
          `Generated proposal is too short (${proposalText.length} chars), attempting to extend...`,
        );
        // Try to extend if too short
        const extensionPrompt = `Extend the following proposal to be at least ${this.MIN_PROPOSAL_LENGTH} characters while maintaining professionalism:\n\n${proposalText}`;
        const extendedResponse = await this.aiService.generateContent(
          extensionPrompt,
          { temperature: 0.7, maxTokens: 1000 },
        );
        proposalText = extendedResponse.text.trim();
      }

      // Clean up the text (remove markdown, bullets, etc.)
      proposalText = this.cleanProposalText(proposalText);

      return proposalText;
    } catch (error) {
      this.logger.error(
        `Failed to generate proposal for talent ${talentId} and mission ${missionId}: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'AI generation is temporarily unavailable. Please try again later or write your proposal manually.',
      );
    }
  }

  /**
   * Build the prompt for proposal generation
   */
  private buildProposalPrompt(mission: any, talentData: any): string {
    const missionInfo = `
Mission Title: ${mission.title}
Mission Description: ${mission.description}
Required Skills: ${mission.skills?.join(', ') || 'Not specified'}
Duration: ${mission.duration || 'Not specified'}
Budget: ${mission.budget ? `${mission.budget}€` : 'Not specified'}
`;

    const talentInfo = `
Talent Name: ${talentData.name}
Headline: ${talentData.headline || 'Not provided'}
Skills: ${talentData.skills?.join(', ') || 'None specified'}
`;

    let projectsInfo = '';
    if (talentData.projects && talentData.projects.length > 0) {
      projectsInfo = '\nKey Projects:\n';
      talentData.projects.forEach((p: any) => {
        projectsInfo += `- ${p.title}${p.role ? ` (${p.role})` : ''}${p.description ? `: ${p.description}` : ''}\n`;
      });
    }

    let analysisInfo = '';
    if (talentData.profileAnalysis) {
      analysisInfo = `
Profile Summary: ${talentData.profileAnalysis.summary}
Key Strengths: ${talentData.profileAnalysis.keyStrengths?.join(', ') || 'Not available'}
`;
    }

    let cvInfo = '';
    if (talentData.cvText) {
      // Limit CV text to first 1000 characters to avoid token limits
      const cvPreview = talentData.cvText.substring(0, 1000);
      cvInfo = `\nCV Preview: ${cvPreview}${talentData.cvText.length > 1000 ? '...' : ''}`;
    }

    return `You are a professional freelancer writing a client-facing proposal for a mission opportunity.

${missionInfo}

Your Profile:
${talentInfo}${projectsInfo}${analysisInfo}${cvInfo}

Instructions:
1. Write a professional, client-facing proposal (not a cover letter).
2. Reference the mission title and key requirements.
3. Highlight your relevant skills and experience that match the mission.
4. Mention a high-level approach or plan for completing the mission.
5. Align with the mission duration and budget if provided.
6. Write in a professional but personable tone.
7. The output must be plain text only - NO markdown, NO JSON, NO bullet points, NO formatting symbols.
8. Write in complete sentences and paragraphs.
9. The proposal should be at least ${this.MIN_PROPOSAL_LENGTH} characters long.
10. Write in French if the mission description is in French, otherwise write in English.

Generate the proposal now:`;
  }

  /**
   * Clean proposal text to remove markdown and formatting
   */
  private cleanProposalText(text: string): string {
    // Remove markdown code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    // Remove markdown headers
    text = text.replace(/^#+\s+/gm, '');
    // Remove markdown bold/italic
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    // Remove markdown links
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Remove bullet points and list markers
    text = text.replace(/^[\s]*[-*•]\s+/gm, '');
    text = text.replace(/^\d+\.\s+/gm, '');
    // Remove extra whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }

  /**
   * Extract text from CV PDF file
   */
  private async extractCvText(cvUrl: string): Promise<string> {
    try {
      // cvUrl might be a relative path or full path
      let filePath = cvUrl;
      if (!path.isAbsolute(cvUrl)) {
        filePath = path.join(process.cwd(), cvUrl);
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        // Try with uploads/cv prefix
        filePath = path.join(process.cwd(), 'uploads', 'cv', path.basename(cvUrl));
        await fs.access(filePath);
      }

      const dataBuffer = await fs.readFile(filePath);
      const data = await PDFParse(dataBuffer);
      return data.text || '';
    } catch (error) {
      this.logger.warn(`Failed to extract CV text from ${cvUrl}: ${error.message}`);
      return '';
    }
  }
}


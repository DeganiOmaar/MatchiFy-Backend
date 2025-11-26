import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiController } from './ai.controller';
import { GeminiService } from './services/gemini.service';
import { OllamaService } from './services/ollama.service';
import { AiService } from './services/ai.service';
import { AiProfileAnalyzerService } from './services/ai-profile-analyzer.service';
import { ProfileAnalysisService } from './services/profile-analysis.service';
import { ProfileAnalysis, ProfileAnalysisSchema } from './schemas/profile-analysis.schema';
import {
  MissionFitAnalysis,
  MissionFitAnalysisSchema,
} from './schemas/mission-fit-analysis.schema';
import { UserModule } from '../user/user.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { SkillModule } from '../skill/skill.module';
import { forwardRef } from '@nestjs/common';
import { MissionsModule } from '../missions/missions.module';
import { MissionFitAnalyzerService } from './services/mission-fit-analyzer.service';
import { ProposalGeneratorService } from './services/proposal-generator.service';
import { AiProposalMatchService } from './services/ai-proposal-match.service';
import { Proposal, ProposalSchema } from '../proposals/schemas/proposal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProfileAnalysis.name, schema: ProfileAnalysisSchema },
      { name: MissionFitAnalysis.name, schema: MissionFitAnalysisSchema },
      { name: Proposal.name, schema: ProposalSchema },
    ]),
    UserModule,
    PortfolioModule,
    SkillModule,
    forwardRef(() => MissionsModule),
  ],
  controllers: [AiController],
  providers: [
    GeminiService,
    OllamaService,
    AiService,
    AiProfileAnalyzerService,
    ProfileAnalysisService,
    MissionFitAnalyzerService,
    ProposalGeneratorService,
    AiProposalMatchService,
  ],
  exports: [AiService, AiProfileAnalyzerService, ProfileAnalysisService, AiProposalMatchService],
})
export class AiModule {}


import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiController } from './ai.controller';
import { GeminiService } from './services/gemini.service';
import { OllamaService } from './services/ollama.service';
import { AiService } from './services/ai.service';
import { AiProfileAnalyzerService } from './services/ai-profile-analyzer.service';
import { ProfileAnalysisService } from './services/profile-analysis.service';
import { ProfileAnalysis, ProfileAnalysisSchema } from './schemas/profile-analysis.schema';
import { UserModule } from '../user/user.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { SkillModule } from '../skill/skill.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProfileAnalysis.name, schema: ProfileAnalysisSchema },
    ]),
    UserModule,
    PortfolioModule,
    SkillModule,
  ],
  controllers: [AiController],
  providers: [
    GeminiService,
    OllamaService,
    AiService,
    AiProfileAnalyzerService,
    ProfileAnalysisService,
  ],
  exports: [AiService, AiProfileAnalyzerService, ProfileAnalysisService],
})
export class AiModule {}


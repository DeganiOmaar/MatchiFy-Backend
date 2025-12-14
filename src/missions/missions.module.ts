import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { Mission, MissionSchema } from './schemas/mission.schema';
import {
  MissionRankingCache,
  MissionRankingCacheSchema,
} from './schemas/mission-ranking-cache.schema';
import { MissionsEventsService } from './missions-events.service';
import { BestMatchService } from './services/best-match.service';
import { AuthModule } from '../auth/auth.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Mission.name, schema: MissionSchema },
      { name: MissionRankingCache.name, schema: MissionRankingCacheSchema },
    ]),
    AiModule,
    forwardRef(() => AuthModule),
    forwardRef(() => ProposalsModule),
    forwardRef(() => FavoritesModule),
  ],
  controllers: [MissionsController],
  providers: [MissionsService, MissionsEventsService, BestMatchService],
  exports: [MissionsService, BestMatchService],
})
export class MissionsModule {}


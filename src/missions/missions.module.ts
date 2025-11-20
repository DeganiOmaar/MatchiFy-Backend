import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { Mission, MissionSchema } from './schemas/mission.schema';
import { MissionsEventsService } from './missions-events.service';
import { AuthModule } from 'src/auth/auth.module';
import { ProposalsModule } from 'src/proposals/proposals.module';
import { FavoritesModule } from 'src/favorites/favorites.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => ProposalsModule),
    forwardRef(() => FavoritesModule),
    MongooseModule.forFeature([{ name: Mission.name, schema: MissionSchema }]),
  ],
  controllers: [MissionsController],
  providers: [MissionsService, MissionsEventsService],
  exports: [MissionsService],
})
export class MissionsModule {}


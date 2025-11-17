import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { Mission, MissionSchema } from './schemas/mission.schema';
import { MissionsEventsService } from './missions-events.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: Mission.name, schema: MissionSchema }]),
  ],
  controllers: [MissionsController],
  providers: [MissionsService, MissionsEventsService],
  exports: [MissionsService],
})
export class MissionsModule {}


import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { Proposal, ProposalSchema } from './schemas/proposal.schema';
import { AuthModule } from 'src/auth/auth.module';
import { MissionsModule } from 'src/missions/missions.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => MissionsModule),
    MongooseModule.forFeature([{ name: Proposal.name, schema: ProposalSchema }]),
  ],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}


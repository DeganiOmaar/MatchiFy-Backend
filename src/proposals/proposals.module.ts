import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { Proposal, ProposalSchema } from './schemas/proposal.schema';
import { AuthModule } from '../auth/auth.module';
import { MissionsModule } from '../missions/missions.module';
import { UserModule } from '../user/user.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => MissionsModule),
    UserModule,
    forwardRef(() => ConversationsModule),
    AlertsModule,
    MongooseModule.forFeature([{ name: Proposal.name, schema: ProposalSchema }]),
  ],
  controllers: [ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}


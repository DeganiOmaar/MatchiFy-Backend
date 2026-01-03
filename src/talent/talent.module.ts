import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';
import { UserModule } from 'src/user/user.module';
import { SkillModule } from '../skill/skill.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { PaymentTransaction, PaymentTransactionSchema } from '../payment/schemas/payment-transaction.schema';

@Module({
  imports: [
    UserModule,
    SkillModule,
    ProposalsModule,
    MongooseModule.forFeature([
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
    ]),
  ],
  controllers: [TalentController],
  providers: [TalentService]
})
export class TalentModule { }

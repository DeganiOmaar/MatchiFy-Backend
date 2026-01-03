import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Mission, MissionSchema } from '../missions/schemas/mission.schema';
import {
    PaymentTransaction,
    PaymentTransactionSchema,
} from './schemas/payment-transaction.schema';
import { WalletModule } from '../wallet/wallet.module';

@Module({
    imports: [
        ConfigModule,
        MongooseModule.forFeature([
            { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
            { name: Mission.name, schema: MissionSchema },
        ]),
        forwardRef(() => WalletModule),
    ],
    controllers: [PaymentController],
    providers: [PaymentService],
    exports: [PaymentService],
})
export class PaymentModule { }

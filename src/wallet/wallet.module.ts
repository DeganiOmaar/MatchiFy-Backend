import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { PaymentModule } from '../payment/payment.module';
import {
    PaymentTransaction,
    PaymentTransactionSchema,
} from '../payment/schemas/payment-transaction.schema';

@Module({
    imports: [
        ConfigModule,
        MongooseModule.forFeature([
            { name: Wallet.name, schema: WalletSchema },
            { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
        ]),
        forwardRef(() => PaymentModule),
    ],
    controllers: [WalletController],
    providers: [WalletService],
    exports: [WalletService],
})
export class WalletModule { }

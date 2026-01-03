import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface WalletDocument extends Wallet, Document {
    createdAt: Date;
    updatedAt: Date;
}

@Schema({ timestamps: true })
export class Wallet extends Document {
    @Prop({ required: true, type: String, unique: true, index: true })
    userId: string;

    @Prop({ required: true, type: String, enum: ['talent', 'recruiter'] })
    role: string;

    @Prop({ type: Number, default: 0 })
    availableBalance: number;

    @Prop({ type: Number, default: 0 })
    pendingBalance: number;

    @Prop({ type: Number, default: 0 })
    totalEarned: number;

    @Prop({ type: Number, default: 0 })
    totalSpent: number;

    @Prop({ type: String })
    stripeCustomerId?: string;

    @Prop({ type: String })
    stripeConnectAccountId?: string;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum TransactionDirection {
  IN = 'in',
  OUT = 'out',
}

export interface PaymentTransactionDocument extends PaymentTransaction, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class PaymentTransaction extends Document {
  @Prop({ required: true, type: String, index: true })
  missionId: string;

  @Prop({ required: true, type: String, index: true })
  recruiterId: string;

  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop({ required: true, type: Number })
  amount: number;

  @Prop({ required: true, type: Number })
  platformFee: number;

  @Prop({ required: true, type: Number })
  talentAmount: number;

  @Prop({ type: String })
  stripePaymentIntentId?: string;

  @Prop({ type: String })
  stripeTransferId?: string;

  @Prop({
    type: String,
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
    index: true,
  })
  status: TransactionStatus;

  @Prop({
    type: String,
    enum: TransactionDirection,
    required: true,
  })
  direction: TransactionDirection;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: String })
  errorMessage?: string;
}

export const PaymentTransactionSchema = SchemaFactory.createForClass(PaymentTransaction);

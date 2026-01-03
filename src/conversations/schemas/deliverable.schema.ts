import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeliverableType = 'file' | 'link';
export type DeliverableStatus = 'pending_review' | 'approved' | 'rejected' | 'revision_requested';

export interface DeliverableDocument extends Deliverable, Document {
    createdAt: Date;
    updatedAt: Date;
}

@Schema({ timestamps: true })
export class Deliverable extends Document {
    @Prop({ required: true, index: true })
    messageId: string;

    @Prop({ required: true, index: true })
    missionId: string;

    @Prop({ required: true, index: true })
    senderId: string; // Talent

    @Prop({ required: true, index: true })
    receiverId: string; // Recruiter

    @Prop({ required: true, enum: ['file', 'link'], default: 'file' })
    type: DeliverableType;

    @Prop({ required: true })
    url: string; // File URL or External Link

    @Prop() // Legacy field, kept for backward compatibility mapping if needed
    fileUrl?: string;

    @Prop()
    fileType?: string; // Optional for links

    @Prop()
    fileName?: string; // Optional for links

    @Prop()
    fileSize?: number;

    @Prop({ required: true, default: 'pending_review', index: true, enum: ['pending_review', 'approved', 'rejected', 'revision_requested'] })
    status: DeliverableStatus;

    @Prop()
    rejectionReason?: string;

    @Prop()
    approvedAt?: Date;
}

export const DeliverableSchema = SchemaFactory.createForClass(Deliverable);

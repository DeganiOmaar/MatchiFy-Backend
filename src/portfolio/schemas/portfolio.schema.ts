import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface PortfolioDocument extends Portfolio, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Portfolio {
  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  role?: string;

  @Prop()
  media?: string; // Path to uploaded image or video

  @Prop()
  mediaType?: string; // 'image' or 'video'

  @Prop({
    type: [String],
    default: [],
  })
  skills: string[];

  @Prop()
  description?: string;
}

export const PortfolioSchema = SchemaFactory.createForClass(Portfolio);


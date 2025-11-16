import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface MissionDocument extends Mission, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Mission extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  duration: string;

  @Prop({ required: true, type: Number })
  budget: number;

  @Prop({
    type: [String],
    required: true,
    validate: {
      validator: (skills: string[]) => skills.length <= 10,
      message: 'Skills array cannot exceed 10 elements',
    },
  })
  skills: string[];

  @Prop({ required: true, type: String, index: true })
  recruiterId: string;
}

export const MissionSchema = SchemaFactory.createForClass(Mission);


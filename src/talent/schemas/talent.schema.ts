// src/talent/schemas/talent.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Talent extends Document {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  // ✅ Le rôle doit être soit 'talent', soit 'recruiter'
  @Prop({
    required: true,
    enum: ['talent', 'recruiter'], // ✅ limite les valeurs possibles
  })
  role: 'talent' | 'recruiter';

  @Prop()
  phone?: string;

  @Prop()
  profileImage?: string;

  @Prop()
  location?: string;

  @Prop()
  talent?: string;

  @Prop({ default: false })
  isProfileComplete: boolean;
}

export const TalentSchema = SchemaFactory.createForClass(Talent);

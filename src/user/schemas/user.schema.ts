// src/user/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

@Prop({
  type: String,
  enum: ['talent', 'recruiter'], // ✅ deux rôles possibles
  default: 'talent',
})
role: string;


  @Prop()
  name?: string;

  @Prop()
  phone?: string;

  @Prop()
  profileImage?: string;

  @Prop()
  bannerImage?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

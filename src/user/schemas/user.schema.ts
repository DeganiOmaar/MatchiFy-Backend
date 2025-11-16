import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface UserDocument extends User, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: String,
    enum: ['talent', 'recruiter'],
    required: true,
  })
  role: string;
 

  // 🧑‍💼 Informations de base
  @Prop({ default: null })
  name?: string;

  @Prop({ default: null })
  phone?: string;

  @Prop({ default: null })
  bio?: string; // 🧠 "À propos"

  @Prop({ default: null })
  location?: string; // 📍 Ville

  // 🖼️ Images de profil
  @Prop({ default: null })
  profileImage?: string;

  @Prop({ default: null })
  bannerImage?: string;

  // 👥 Réseaux sociaux et statistiques
  @Prop({ default: 0 })
  followers?: number;

  @Prop({ default: 0 })
  following?: number;

  // 🎨 Portfolio (URLs des images)
  @Prop({ type: [String], default: [] })
  portfolioImages?: string[];

 

  // Talent-specific fields


  @Prop()
  talent?: string;

  // Password reset fields
  @Prop()
  resetCode?: string;

  @Prop()
  resetCodeExpiresAt?: Date;

  @Prop()
  verifiedEmail?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

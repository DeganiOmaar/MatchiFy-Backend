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

  // 🔗 Liens sociaux
  @Prop({
    type: {
      linkedin: { type: String, default: null },
      github: { type: String, default: null },
      google: { type: String, default: null },
      portfolio: { type: String, default: null },
    },
    default: {},
  })
  socialLinks?: {
    linkedin?: string;
    github?: string;
    google?: string;
    portfolio?: string;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);

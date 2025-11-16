import { Injectable, NotFoundException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Injectable()
export class TalentService {
  constructor(private readonly userService: UserService) {}

  // --------------------------------------------------------------------
  // 📌 Lire le profil du talent connecté
  // --------------------------------------------------------------------
  async getProfile(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  // --------------------------------------------------------------------
  // 📌 Compléter le profil (signup étape 2)
  // --------------------------------------------------------------------
  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    // 🔥 Mise à jour uniquement des champs envoyés ET non vides
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        user[key] = value;
      }
    });

    await this.userService.save(user);

    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  // --------------------------------------------------------------------
  // 📌 Upload photo de profil
  // --------------------------------------------------------------------
  async updateProfileImage(userId: string, imageUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    user.profileImage = imageUrl;
    await this.userService.save(user);

    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  // --------------------------------------------------------------------
  // 📌 Upload bannière
  // --------------------------------------------------------------------
  async updateBannerImage(userId: string, bannerUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    user.bannerImage = bannerUrl;
    await this.userService.save(user);

    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  // --------------------------------------------------------------------
  // 📌 Ajouter des images de portfolio
  // --------------------------------------------------------------------
  async addPortfolioImages(userId: string, imageUrls: string[]) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    // Initialise le tableau s'il est vide, puis ajoute les nouvelles images
    const current = user['portfolioImages'] || [];
    user['portfolioImages'] = [...current, ...imageUrls];

    await this.userService.save(user);

    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }
}

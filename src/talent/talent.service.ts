import { Injectable, NotFoundException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UpdateTalentDto } from './dto/update-talent.dto';

@Injectable()
export class TalentService {
  constructor(private readonly userService: UserService) {}

  // 🔍 Lire le profil du talent connecté
  async getProfile(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  // ✏️ Modifier les coordonnées du talent


  // 📸 Upload de la photo de profil
  async updateProfileImage(userId: string, imageUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    user.profileImage = imageUrl;
    await this.userService.save(user);

    // ✅ Retourne le profil complet mis à jour
    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  // 🖼️ Upload de la bannière
  async updateBannerImage(userId: string, bannerUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    user.bannerImage = bannerUrl;
    await this.userService.save(user);

    // ✅ Retourne le profil complet mis à jour
    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }
}

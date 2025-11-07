import { Injectable, NotFoundException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UpdateTalentDto } from './dto/update-talent.dto';

@Injectable()
export class TalentService {
  constructor(private readonly userService: UserService) {}

  // 🔍 Lire le profil du talent
  async getProfile(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    const { password, ...safeUser } = user.toObject();
    return safeUser;
  }

  // ✏️ Mettre à jour les infos du profil
  async updateProfile(userId: string, updateDto: UpdateTalentDto) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    Object.assign(user, updateDto);
    await this.userService.save(user);

    const { password, ...safeUser } = user.toObject();
    return { message: 'Profile updated successfully', user: safeUser };
  }

  // 📸 Mettre à jour la photo de profil
  async updateProfileImage(userId: string, imageUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    user.profileImage = imageUrl;
    await this.userService.save(user);

    return { message: 'Profile image updated', profileImage: imageUrl };
  }

  // 🖼️ Mettre à jour la bannière
  async updateBannerImage(userId: string, bannerUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Talent not found');

    user.bannerImage = bannerUrl;
    await this.userService.save(user);

    return { message: 'Banner updated', bannerImage: bannerUrl };
  }
}

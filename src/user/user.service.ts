import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  // ✅ Créer un utilisateur
  async create(data: Partial<User>): Promise<User> {
    const user = new this.userModel(data);
    return user.save();
  }

  // ✅ Trouver un utilisateur par email (utile pour le login)
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // ✅ Trouver un utilisateur par ID (utilisé par TalentService)
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id);
  }

  // ✅ Sauvegarder les modifications d’un user (profil, image, etc.)
  async save(user: User): Promise<User> {
    return user.save();
  }

  // ✅ Mettre à jour le mot de passe (pour forgot/reset password)
  async updatePassword(id: string, newPassword: string): Promise<User> {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      id,
      { password: newPassword },
      { new: true }
    );

    if (!updatedUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return updatedUser;
  }
}

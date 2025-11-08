import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';
@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(data: Partial<User>): Promise<User> {
    const user = new this.userModel(data);
    return user.save();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id);
  }

  async save(user: User): Promise<User> {
    return user.save();
  }

  // ✅ Nouvelle méthode pour mettre à jour le mot de passe
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

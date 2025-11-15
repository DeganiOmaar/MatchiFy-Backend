import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UpdateRecruiterProfileDto } from './dto/update-recruiter-profile.dto';

@Injectable()
export class RecruiterService {
  constructor(private readonly userService: UserService) {}

  async updateProfile(
    userId: string,
    updateDto: UpdateRecruiterProfileDto,
    profileImagePath?: string
  ) {
    // Find the user
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is a recruiter
    if (user.role !== 'recruiter') {
      throw new ForbiddenException('Only recruiters can access this endpoint');
    }

    // Prepare update data
    const updateData: any = {};

    // Only update provided fields
    if (updateDto.fullName !== undefined) {
      updateData.fullName = updateDto.fullName;
    }

    if (updateDto.email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await this.userService.findByEmailExcludingId(
        updateDto.email,
        userId
      );
      if (existingUser) {
        throw new BadRequestException('Email already in use by another account');
      }
      updateData.email = updateDto.email;
    }

    if (updateDto.phone !== undefined) {
      updateData.phone = updateDto.phone;
    }

    if (updateDto.location !== undefined) {
      updateData.location = updateDto.location;
    }

    // If profile image was uploaded, add the path
    if (profileImagePath) {
      updateData.profileImage = profileImagePath;
    }

    // Update user in database
    const updatedUser = await this.userService.updateById(userId, updateData);

    if (!updatedUser) {
      throw new NotFoundException('Failed to update profile');
    }

    // Return user without password
    const { password, ...userWithoutPassword } = updatedUser.toObject();
    return {
      message: 'Profile updated successfully',
      user: userWithoutPassword,
    };
  }
}

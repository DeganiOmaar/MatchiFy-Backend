import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { SkillService } from '../skill/skill.service';
import { UpdateTalentProfileDto } from './dto/update-talent-profile.dto';
import { ProposalsService } from '../proposals/proposals.service';
import { TalentStatsDto } from './dto/talent-stats.dto';
import { ProposalStatus } from '../proposals/schemas/proposal.schema';

@Injectable()
export class TalentService {
  constructor(
    private readonly userService: UserService,
    private readonly skillService: SkillService,
    private readonly proposalsService: ProposalsService,
  ) {}

  /**
   * Get talent profile
   * Returns all talent profile information
   */
  async getProfile(userId: string) {
    // Find the user
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is a talent
    if (user.role !== 'talent') {
      throw new ForbiddenException('Only talents can access this endpoint');
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user.toObject();
    return {
      message: 'Profile retrieved successfully',
      user: userWithoutPassword,
    };
  }

  /**
   * Update talent profile
   * Supports partial updates - only provided fields will be updated
   */
  async updateProfile(
    userId: string,
    updateDto: UpdateTalentProfileDto,
    profileImagePath?: string,
  ) {
    // Find the user
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is a talent
    if (user.role !== 'talent') {
      throw new ForbiddenException('Only talents can access this endpoint');
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
        userId,
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

    if (updateDto.talent !== undefined) {
      updateData.talent = updateDto.talent;
    }

    if (updateDto.description !== undefined) {
      updateData.description = updateDto.description;
    }

    if (updateDto.skills !== undefined) {
      // Limit to 10 skills
      if (updateDto.skills.length > 10) {
        throw new BadRequestException('Maximum 10 skills allowed');
      }

      // Process skills: find or create each skill
      const skillIds: string[] = [];
      for (const skillName of updateDto.skills) {
        if (typeof skillName === 'string' && skillName.trim()) {
          try {
            const skill = await this.skillService.findOrCreateSkill(
              skillName.trim(),
              userId
            );
            if (skill && skill._id) {
              skillIds.push(skill._id.toString());
            }
          } catch (error) {
            throw new BadRequestException(`Invalid skill: ${skillName}`);
          }
        }
      }

      updateData.skills = skillIds;
    }

    if (updateDto.portfolioLink !== undefined) {
      // Validate URL if provided and not empty
      if (updateDto.portfolioLink && updateDto.portfolioLink.trim() !== '') {
        try {
          new URL(updateDto.portfolioLink);
        } catch {
          throw new BadRequestException('Please provide a valid URL for portfolio link');
        }
      }
      updateData.portfolioLink = updateDto.portfolioLink;
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

  // 📸 Mettre à jour la photo de profil (kept for backward compatibility)
  async updateProfileImage(userId: string, imageUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('Talent not found');
    }

    user.profileImage = imageUrl;
    await this.userService.save(user);

    return { message: 'Profile image updated', profileImage: imageUrl };
  }

  // 🖼️ Mettre à jour la bannière (kept for backward compatibility)
  async updateBannerImage(userId: string, bannerUrl: string) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('Talent not found');
    }

    user.bannerImage = bannerUrl;
    await this.userService.save(user);

    return { message: 'Banner updated', bannerImage: bannerUrl };
  }

  /**
   * Get talent stats for proposals
   * Returns aggregated proposal statistics for a given date range
   */
  async getStats(userId: string, days: number): Promise<TalentStatsDto> {
    // Find the user
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is a talent
    if (user.role !== 'talent') {
      throw new ForbiddenException('Only talents can access this endpoint');
    }

    // Calculate date range
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    // Get all proposals for this talent in the date range
    // Using the same filters as findByTalent (not archived by recruiter, not deleted by talent)
    const proposals = await this.proposalsService.findByTalentForStats(
      userId,
      fromDate,
      toDate,
    );

    // Count proposals by status
    const totalProposalsSent = proposals.length;
    const totalProposalsAccepted = proposals.filter(
      (p) => p.status === ProposalStatus.ACCEPTED,
    ).length;
    const totalProposalsRefused = proposals.filter(
      (p) => p.status === ProposalStatus.REFUSED,
    ).length;

    return {
      totalProposalsSent,
      totalProposalsAccepted,
      totalProposalsRefused,
    };
  }
}

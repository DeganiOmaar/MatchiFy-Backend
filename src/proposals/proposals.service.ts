import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MissionsService } from '../missions/missions.service';
import { UserService } from '../user/user.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AlertsService } from '../alerts/alerts.service';
import { AlertType } from '../alerts/schemas/alert.schema';
import {
  Proposal,
  ProposalDocument,
  ProposalStatus,
} from './schemas/proposal.schema';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';

interface TalentContext {
  id: string;
  fullName?: string;
}

@Injectable()
export class ProposalsService {
  constructor(
    @InjectModel(Proposal.name)
    private readonly proposalModel: Model<ProposalDocument>,
    private readonly missionsService: MissionsService,
    private readonly userService: UserService,
    private readonly conversationsService: ConversationsService,
    private readonly alertsService: AlertsService
  ) {}

  async create(
    createProposalDto: CreateProposalDto,
    talent: TalentContext
  ): Promise<any> {
    const mission = await this.missionsService.findOne(
      createProposalDto.missionId
    );

    if (!mission) {
      throw new NotFoundException(
        `Mission ${createProposalDto.missionId} not found`
      );
    }

    // Check for duplicate proposal
    const existingProposal = await this.proposalModel
      .findOne({
        missionId: createProposalDto.missionId,
        talentId: talent.id,
      })
      .exec();

    if (existingProposal) {
      throw new BadRequestException(
        'Proposal already submitted for this mission'
      );
    }

    const recruiterId = mission.recruiterId?.toString();
    if (!recruiterId) {
      throw new BadRequestException('Mission recruiter is missing');
    }

    // Get recruiter name
    const recruiter = await this.userService.findById(recruiterId);
    const recruiterName = recruiter?.fullName || 'Recruiter';

    // Validate proposalContent length (additional check beyond DTO validation)
    const proposalContent = createProposalDto.proposalContent?.trim() || '';
    if (proposalContent.length < 200) {
      throw new BadRequestException(
        'Proposal content must be at least 200 characters long'
      );
    }

    const proposal = new this.proposalModel({
      missionId: createProposalDto.missionId,
      missionTitle: mission.title,
      recruiterId,
      recruiterName,
      talentId: talent.id,
      talentName: talent.fullName,
      message: createProposalDto.message || '',
      proposalContent: proposalContent,
      proposedBudget: createProposalDto.proposedBudget,
      estimatedDuration: createProposalDto.estimatedDuration,
      status: ProposalStatus.NOT_VIEWED,
    });

    const saved = await proposal.save();
    await this.missionsService.incrementProposalCount(proposal.missionId, 1);
    
    // Populate talent information in the response
    const talentUser = await this.userService.findById(talent.id);
    
    // Create alert for recruiter (mission owner)
    try {
      const talentFullName = talent.fullName || talentUser?.fullName || 'A talent';
      await this.alertsService.create({
        userId: recruiterId,
        type: AlertType.PROPOSAL_SUBMITTED,
        missionId: proposal.missionId,
        proposalId: (saved._id as any).toString(),
        title: `${talentFullName} has applied to ${mission.title}`,
        message: `${talentFullName} has submitted a proposal for your mission "${mission.title}".`,
        talentId: talent.id,
        talentName: talentFullName,
        talentProfileImage: talentUser?.profileImage,
        missionTitle: mission.title,
      });
    } catch (error) {
      // Log error but don't fail proposal creation
      console.error('Failed to create alert for proposal:', error);
    }
    
    return {
      ...saved.toObject(),
      talent: talentUser
        ? {
            fullName: talentUser.fullName,
            email: talentUser.email,
          }
        : null,
    };
  }

  async findByTalent(
    talentId: string,
    filters?: { status?: string; archived?: boolean }
  ): Promise<any[]> {
    const query: any = { 
      talentId,
      deletedByTalent: { $ne: true }
    };
    
    if (filters?.status) {
      query.status = filters.status;
    }
    
    if (filters?.archived !== undefined) {
      query.archived = filters.archived;
    }
    
    const proposals = await this.proposalModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    // Populate talent information for each proposal
    return Promise.all(
      proposals.map(async (proposal) => {
        const talent = await this.userService.findById(proposal.talentId);
        return {
          ...proposal,
          talent: talent
            ? {
                fullName: talent.fullName,
                email: talent.email,
              }
            : null,
        };
      })
    );
  }

  /**
   * Find proposals by talent for stats calculation
   * Returns proposals within a date range, excluding archived and deleted ones
   */
  async findByTalentForStats(
    talentId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<any[]> {
    const query: any = {
      talentId,
      deletedByTalent: { $ne: true },
      createdAt: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    // Exclude proposals archived by recruiter (we want all proposals for stats)
    // But we still exclude those deleted by talent
    
    const proposals = await this.proposalModel
      .find(query)
      .lean()
      .exec();

    return proposals;
  }

  async findByRecruiter(
    recruiterId: string,
    missionId?: string
  ): Promise<any[]> {
    const query: any = { recruiterId };
    
    if (missionId) {
      query.missionId = missionId;
    }
    
    const proposals = await this.proposalModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    // Populate talent information for each proposal
    return Promise.all(
      proposals.map(async (proposal) => {
        const talent = await this.userService.findById(proposal.talentId);
        return {
          ...proposal,
          talent: talent
            ? {
                fullName: talent.fullName,
                email: talent.email,
              }
            : null,
        };
      })
    );
  }

  async findByMissionGrouped(recruiterId: string): Promise<any> {
    const proposals = await this.proposalModel
      .find({ recruiterId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    // Group by missionId
    const grouped: { [key: string]: any[] } = {};
    
    for (const proposal of proposals) {
      const missionId = proposal.missionId;
      if (!grouped[missionId]) {
        grouped[missionId] = [];
      }
      
      const talent = await this.userService.findById(proposal.talentId);
      grouped[missionId].push({
        ...proposal,
        talent: talent
          ? {
              fullName: talent.fullName,
              email: talent.email,
            }
          : null,
      });
    }
    
    return grouped;
  }

  async countByMission(missionId: string): Promise<number> {
    return this.proposalModel.countDocuments({ missionId }).exec();
  }

  async hasTalentApplied(missionId: string, talentId: string): Promise<boolean> {
    const proposal = await this.proposalModel
      .findOne({
        missionId,
        talentId,
      })
      .exec();
    return !!proposal;
  }

  async getUnreadCountForRecruiter(recruiterId: string): Promise<number> {
    return this.proposalModel.countDocuments({
      recruiterId,
      status: ProposalStatus.NOT_VIEWED,
    }).exec();
  }

  async findOne(
    proposalId: string,
    userId: string,
    userRole: string
  ): Promise<any> {
    const proposal = await this.proposalModel.findById(proposalId).lean().exec();
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    // Auto-mark as VIEWED if recruiter opens and status is NOT_VIEWED
    if (
      userRole === 'recruiter' &&
      proposal.recruiterId === userId &&
      proposal.status === ProposalStatus.NOT_VIEWED
    ) {
      await this.proposalModel.findByIdAndUpdate(proposalId, {
        status: ProposalStatus.VIEWED,
      });
      proposal.status = ProposalStatus.VIEWED;
    }

    // Populate talent information
    const talent = await this.userService.findById(proposal.talentId);
    return {
      ...proposal,
      talent: talent
        ? {
            fullName: talent.fullName,
            email: talent.email,
          }
        : null,
    };
  }

  async updateStatus(
    proposalId: string,
    recruiterId: string,
    updateProposalStatusDto: UpdateProposalStatusDto
  ): Promise<any> {
    const proposal = await this.proposalModel.findById(proposalId).exec();
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.recruiterId !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to update this proposal'
      );
    }

    const previousStatus = proposal.status;
    proposal.status = updateProposalStatusDto.status;
    const saved = await proposal.save();

    // Create conversation when proposal is accepted
    if (
      updateProposalStatusDto.status === ProposalStatus.ACCEPTED &&
      previousStatus !== ProposalStatus.ACCEPTED
    ) {
      try {
        await this.conversationsService.findOrCreate(
          {
            missionId: proposal.missionId,
            talentId: proposal.talentId,
          },
          recruiterId,
          'recruiter'
        );
      } catch (error) {
        // Log error but don't fail the proposal update
        console.error('Failed to create conversation:', error);
      }
    }

    // Create alert for talent when proposal status changes
    try {
      const mission = await this.missionsService.findOne(proposal.missionId);
      const recruiter = await this.userService.findById(recruiterId);
      const recruiterName = recruiter?.fullName || 'Recruiter';
      const missionTitle = mission?.title || proposal.missionTitle || 'Mission';

      if (updateProposalStatusDto.status === ProposalStatus.ACCEPTED) {
        await this.alertsService.create({
          userId: proposal.talentId,
          type: AlertType.PROPOSAL_ACCEPTED,
          missionId: proposal.missionId,
          proposalId: (proposal._id as any).toString(),
          title: `Your proposal for ${missionTitle} has been accepted`,
          message: `Great news! Your proposal for "${missionTitle}" has been accepted by ${recruiterName}.`,
          recruiterId: recruiterId,
          recruiterName: recruiterName,
          recruiterProfileImage: recruiter?.profileImage,
          missionTitle: missionTitle,
        });
      } else if (updateProposalStatusDto.status === ProposalStatus.REFUSED) {
        await this.alertsService.create({
          userId: proposal.talentId,
          type: AlertType.PROPOSAL_REFUSED,
          missionId: proposal.missionId,
          proposalId: (proposal._id as any).toString(),
          title: `Your proposal for ${missionTitle} has been refused`,
          message: `Your proposal for "${missionTitle}" has been refused by ${recruiterName}.`,
          recruiterId: recruiterId,
          recruiterName: recruiterName,
          recruiterProfileImage: recruiter?.profileImage,
          missionTitle: missionTitle,
        });
      }
    } catch (error) {
      // Log error but don't fail the proposal update
      console.error('Failed to create alert for proposal status update:', error);
    }

    // Populate talent information in the response
    const talent = await this.userService.findById(proposal.talentId);
    return {
      ...saved.toObject(),
      talent: talent
        ? {
            fullName: talent.fullName,
            email: talent.email,
          }
        : null,
    };
  }

  async archiveProposal(
    proposalId: string,
    talentId: string
  ): Promise<any> {
    const proposal = await this.proposalModel.findById(proposalId).exec();
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.talentId !== talentId) {
      throw new ForbiddenException(
        'You do not have permission to archive this proposal'
      );
    }

    proposal.archived = true;
    const saved = await proposal.save();

    const talent = await this.userService.findById(proposal.talentId);
    return {
      ...saved.toObject(),
      talent: talent
        ? {
            fullName: talent.fullName,
            email: talent.email,
          }
        : null,
    };
  }

  async deleteProposal(
    proposalId: string,
    talentId: string
  ): Promise<any> {
    const proposal = await this.proposalModel.findById(proposalId).exec();
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.talentId !== talentId) {
      throw new ForbiddenException(
        'You do not have permission to delete this proposal'
      );
    }

    // Soft delete: mark as deleted by talent, but keep it visible for recruiter
    proposal.deletedByTalent = true;
    const saved = await proposal.save();

    const talent = await this.userService.findById(proposal.talentId);
    return {
      ...saved.toObject(),
      talent: talent
        ? {
            fullName: talent.fullName,
            email: talent.email,
          }
        : null,
    };
  }
}


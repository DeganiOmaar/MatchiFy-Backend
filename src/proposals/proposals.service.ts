import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MissionsService } from 'src/missions/missions.service';
import { UserService } from 'src/user/user.service';
import { ConversationsService } from 'src/conversations/conversations.service';
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
    private readonly conversationsService: ConversationsService
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

    const proposal = new this.proposalModel({
      missionId: createProposalDto.missionId,
      missionTitle: mission.title,
      recruiterId,
      recruiterName,
      talentId: talent.id,
      talentName: talent.fullName,
      message: createProposalDto.message,
      proposedBudget: createProposalDto.proposedBudget,
      estimatedDuration: createProposalDto.estimatedDuration,
      status: ProposalStatus.NOT_VIEWED,
    });

    const saved = await proposal.save();
    await this.missionsService.incrementProposalCount(proposal.missionId, 1);
    
    // Populate talent information in the response
    const talentUser = await this.userService.findById(talent.id);
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

  async findByTalent(talentId: string): Promise<any[]> {
    const proposals = await this.proposalModel
      .find({ talentId })
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

  async findByRecruiter(recruiterId: string): Promise<any[]> {
    const proposals = await this.proposalModel
      .find({ recruiterId })
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
}


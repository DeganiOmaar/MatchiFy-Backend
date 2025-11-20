import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MissionsService } from 'src/missions/missions.service';
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
    private readonly missionsService: MissionsService
  ) {}

  async create(
    createProposalDto: CreateProposalDto,
    talent: TalentContext
  ): Promise<Proposal> {
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

    const proposal = new this.proposalModel({
      missionId: createProposalDto.missionId,
      missionTitle: mission.title,
      recruiterId,
      talentId: talent.id,
      talentName: talent.fullName,
      message: createProposalDto.message,
      proposedBudget: createProposalDto.proposedBudget,
      estimatedDuration: createProposalDto.estimatedDuration,
      status: ProposalStatus.NOT_VIEWED,
    });

    const saved = await proposal.save();
    await this.missionsService.incrementProposalCount(proposal.missionId, 1);
    return saved;
  }

  async findByTalent(talentId: string): Promise<Proposal[]> {
    return this.proposalModel
      .find({ talentId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByRecruiter(recruiterId: string): Promise<Proposal[]> {
    return this.proposalModel
      .find({ recruiterId })
      .sort({ createdAt: -1 })
      .exec();
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

  async updateStatus(
    proposalId: string,
    recruiterId: string,
    updateProposalStatusDto: UpdateProposalStatusDto
  ): Promise<Proposal> {
    const proposal = await this.proposalModel.findById(proposalId).exec();
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    if (proposal.recruiterId !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to update this proposal'
      );
    }

    proposal.status = updateProposalStatusDto.status;
    return proposal.save();
  }
}


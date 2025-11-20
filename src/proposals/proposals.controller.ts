import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';

@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  @Roles('talent')
  async create(@Request() req: any, @Body() dto: CreateProposalDto) {
    const talentContext = {
      id: req.user.id,
      fullName: req.user.fullName ?? req.user.name ?? req.user.email,
    };
    return this.proposalsService.create(dto, talentContext);
  }

  @Get('talent')
  @Roles('talent')
  async getTalentProposals(@Request() req: any) {
    return this.proposalsService.findByTalent(req.user.id);
  }

  @Get('recruiter')
  @Roles('recruiter')
  async getRecruiterProposals(@Request() req: any) {
    return this.proposalsService.findByRecruiter(req.user.id);
  }

  @Get('mission/:missionId/count')
  @Roles('talent', 'recruiter')
  async getMissionCount(@Param('missionId') missionId: string) {
    const count = await this.proposalsService.countByMission(missionId);
    return { missionId, count };
  }

  @Patch(':id/status')
  @Roles('recruiter')
  async updateStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateProposalStatusDto
  ) {
    return this.proposalsService.updateStatus(id, req.user.id, dto);
  }
}


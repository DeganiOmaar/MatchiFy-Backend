import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortfolioService } from '../portfolio/portfolio.service';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly portfolioService: PortfolioService,
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves user information by user ID. Can be used to get talent or recruiter profiles. For talents, includes portfolio projects.',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserById(@Param('id') id: string) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...userWithoutPassword } = user.toObject();
    
    // If user is a talent, include portfolio projects
    if (user.role === 'talent') {
      const portfolio = await this.portfolioService.findAllByTalentId(id);
      return {
        message: 'User retrieved successfully',
        user: userWithoutPassword,
        portfolio: portfolio || [],
      };
    }
    
    return {
      message: 'User retrieved successfully',
      user: userWithoutPassword,
    };
  }
}

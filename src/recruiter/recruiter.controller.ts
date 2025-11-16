import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecruiterService } from './recruiter.service';
import { UpdateRecruiterProfileDto } from './dto/update-recruiter-profile.dto';
import { profileImageUploadOptions } from '../common/utils/file-upload.config';

@ApiTags('recruiter')
@Controller('recruiter')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecruiterController {
  constructor(private readonly recruiterService: RecruiterService) {}

  @Get('profile')
  @Roles('recruiter')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recruiter profile',
    description: 'Retrieves the profile information of the authenticated recruiter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    schema: {
      example: {
        message: 'Profile retrieved successfully',
        user: {
          _id: '673ab2c3e8f9a1234567890b',
          fullName: 'Jane Smith',
          email: 'jane.smith@company.com',
          role: 'recruiter',
          phone: '+1234567890',
          location: 'San Francisco, CA',
          description: 'Experienced tech recruiter specializing in software engineering roles',
          profileImage: 'uploads/profile/profile-1731504922456-123456789.jpg',
          createdAt: '2025-11-13T12:35:22.456Z',
          updatedAt: '2025-11-13T15:20:10.123Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a recruiter',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User does not exist',
  })
  async getProfile(@Request() req: any) {
    const userId = req.user.id;
    return this.recruiterService.getProfile(userId);
  }

  @Put('profile')
  @Roles('recruiter')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update recruiter profile',
    description:
      'Allows authenticated recruiters to update their profile information including full name, email, phone, location, and profile image. Only provided fields will be updated (partial update). Profile image must be PNG, JPG, or JPEG format.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: {
          type: 'string',
          example: 'Jane Smith',
          description: 'Full name of the recruiter',
        },
        email: {
          type: 'string',
          example: 'jane.smith@company.com',
          description: 'Email address (must be unique)',
        },
        phone: {
          type: 'string',
          example: '+1234567890',
          description: 'Phone number',
        },
        location: {
          type: 'string',
          example: 'San Francisco, CA',
          description: 'Location/address',
        },
        description: {
          type: 'string',
          example: 'Experienced tech recruiter specializing in software engineering roles',
          description: 'Profile description or bio',
        },
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Profile image file (PNG, JPG, JPEG only)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      example: {
        message: 'Profile updated successfully',
        user: {
          _id: '673ab2c3e8f9a1234567890b',
          fullName: 'Jane Smith',
          email: 'jane.smith@company.com',
          role: 'recruiter',
          phone: '+1234567890',
          location: 'San Francisco, CA',
          description: 'Experienced tech recruiter specializing in software engineering roles',
          profileImage: 'uploads/profile/profile-1731504922456-123456789.jpg',
          createdAt: '2025-11-13T12:35:22.456Z',
          updatedAt: '2025-11-13T15:20:10.123Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Email already in use or invalid file type',
    schema: {
      example: {
        statusCode: 400,
        message: 'Email already in use by another account',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a recruiter',
    schema: {
      example: {
        statusCode: 403,
        message: 'Only recruiters can access this endpoint',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User does not exist',
    schema: {
      example: {
        statusCode: 404,
        message: 'User not found',
        error: 'Not Found',
      },
    },
  })
  @UseInterceptors(FileInterceptor('profileImage', profileImageUploadOptions))
  async updateProfile(
    @Request() req: any,
    @Body() updateDto: UpdateRecruiterProfileDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const userId = req.user.id;
    const profileImagePath = file ? file.path : undefined;

    return this.recruiterService.updateProfile(
      userId,
      updateDto,
      profileImagePath
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { PortfolioResponseDto } from './dto/portfolio-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { portfolioMediaUploadOptions } from '../common/utils/file-upload.config';

@ApiTags('portfolio')
@Controller('talent/portfolio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('talent')
@ApiBearerAuth()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('media', portfolioMediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a new portfolio project',
    description:
      'Allows authenticated talents to create a new project in their portfolio. Supports uploading an image or video file along with project details.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Project title (required)',
          example: 'E-commerce Mobile App',
        },
        role: {
          type: 'string',
          description: 'Role in the project (optional)',
          example: 'Lead Developer',
        },
        skills: {
          type: 'string',
          description: 'JSON array of skills (optional). Can be sent as JSON string or comma-separated string',
          example: '["React Native", "Node.js", "MongoDB"]',
        },
        description: {
          type: 'string',
          description: 'Project description (optional)',
          example: 'A full-stack e-commerce mobile application with real-time inventory management.',
        },
        media: {
          type: 'string',
          format: 'binary',
          description: 'Image or video file (optional). Supported formats: PNG, JPG, JPEG, GIF, WEBP, MP4, MOV, AVI, MKV, WEBM. Max size: 50MB',
        },
      },
      required: ['title'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file type, file too large, or validation error',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid file type. Only .png, .jpg, .jpeg, .gif, .webp, .mp4, .mov, .avi, .mkv, .webm files are allowed',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User role not allowed',
  })
  async create(
    @Request() req: any,
    @Body() createDto: CreatePortfolioDto,
    @UploadedFile() mediaFile?: Express.Multer.File,
  ) {
    const talentId = req.user.id;
    const project = await this.portfolioService.create(talentId, createDto, mediaFile);
    return {
      message: 'Project created successfully',
      project,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all portfolio projects',
    description: 'Retrieves all portfolio projects for the authenticated talent, sorted by newest first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Projects retrieved successfully',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/PortfolioResponseDto' },
      example: [
        {
          _id: '673ab2c3e8f9a1234567890d',
          talentId: '673ab2c3e8f9a1234567890c',
          title: 'E-commerce Mobile App',
          role: 'Lead Developer',
          media: '/uploads/portfolio/portfolio-image-1234567890.jpg',
          mediaType: 'image',
          skills: ['React Native', 'Node.js', 'MongoDB'],
          description: 'A full-stack e-commerce mobile application.',
          createdAt: '2025-01-15T10:30:00.000Z',
          updatedAt: '2025-01-15T10:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User role not allowed',
  })
  async findAll(@Request() req: any) {
    const talentId = req.user.id;
    const projects = await this.portfolioService.findAllByTalent(talentId);
    return {
      message: 'Projects retrieved successfully',
      projects,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single portfolio project',
    description: 'Retrieves a specific portfolio project by ID. Only the project owner can access it.',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID',
    example: '673ab2c3e8f9a1234567890d',
  })
  @ApiResponse({
    status: 200,
    description: 'Project retrieved successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this project',
    schema: {
      example: {
        statusCode: 403,
        message: 'You do not have permission to access this project',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Project not found',
        error: 'Not Found',
      },
    },
  })
  async findOne(@Request() req: any, @Param('id') id: string) {
    const talentId = req.user.id;
    const project = await this.portfolioService.findOne(id, talentId);
    return {
      message: 'Project retrieved successfully',
      project,
    };
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('media', portfolioMediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a portfolio project',
    description:
      'Allows authenticated talents to update an existing project in their portfolio. Only the project owner can update it. Supports partial updates and media file replacement.',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID',
    example: '673ab2c3e8f9a1234567890d',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Project title (optional)',
          example: 'E-commerce Mobile App - Updated',
        },
        role: {
          type: 'string',
          description: 'Role in the project (optional)',
          example: 'Lead Developer',
        },
        skills: {
          type: 'string',
          description: 'JSON array of skills (optional)',
          example: '["React Native", "Node.js", "MongoDB", "TypeScript"]',
        },
        description: {
          type: 'string',
          description: 'Project description (optional)',
          example: 'A full-stack e-commerce mobile application with advanced features.',
        },
        media: {
          type: 'string',
          format: 'binary',
          description: 'New image or video file to replace existing media (optional)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Project updated successfully',
    type: PortfolioResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file type or validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdatePortfolioDto,
    @UploadedFile() mediaFile?: Express.Multer.File,
  ) {
    const talentId = req.user.id;
    const project = await this.portfolioService.update(id, talentId, updateDto, mediaFile);
    return {
      message: 'Project updated successfully',
      project,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a portfolio project',
    description: 'Allows authenticated talents to delete a project from their portfolio. Only the project owner can delete it.',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID',
    example: '673ab2c3e8f9a1234567890d',
  })
  @ApiResponse({
    status: 200,
    description: 'Project deleted successfully',
    schema: {
      example: {
        message: 'Project deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  async remove(@Request() req: any, @Param('id') id: string) {
    const talentId = req.user.id;
    await this.portfolioService.remove(id, talentId);
    return {
      message: 'Project deleted successfully',
    };
  }
}


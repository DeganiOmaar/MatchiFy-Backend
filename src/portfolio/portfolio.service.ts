import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Portfolio, PortfolioDocument } from './schemas/portfolio.schema';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { extname } from 'path';

// Allowed extensions for portfolio media
const allowedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const allowedVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];

@Injectable()
export class PortfolioService {
  constructor(
    @InjectModel(Portfolio.name) private portfolioModel: Model<PortfolioDocument>,
  ) {}

  /**
   * Create a new portfolio project
   */
  async create(
    talentId: string,
    createDto: CreatePortfolioDto,
    mediaFile?: Express.Multer.File,
  ) {
    const projectData: any = {
      talentId,
      title: createDto.title,
      skills: createDto.skills || [],
    };

    if (createDto.role) {
      projectData.role = createDto.role;
    }

    if (createDto.description) {
      projectData.description = createDto.description;
    }

    // Handle media file upload
    if (mediaFile) {
      const ext = extname(mediaFile.originalname).toLowerCase();
      const isImage = allowedImageExtensions.includes(ext);
      const isVideo = allowedVideoExtensions.includes(ext);

      if (!isImage && !isVideo) {
        throw new BadRequestException('Invalid media file type');
      }

      // Store path relative to uploads folder (e.g., portfolio/portfolio-image-123.jpg)
      // Multer stores as ./uploads/portfolio/filename, we need uploads/portfolio/filename
      let relativePath = mediaFile.path.replace(/\\/g, '/');
      // Remove leading ./ if present
      if (relativePath.startsWith('./')) {
        relativePath = relativePath.substring(2);
      }
      projectData.media = relativePath;
      projectData.mediaType = isImage ? 'image' : 'video';
    }

    const project = await this.portfolioModel.create(projectData);
    return project.toObject();
  }

  /**
   * Get all projects for a talent
   */
  async findAllByTalent(talentId: string) {
    const projects = await this.portfolioModel
      .find({ talentId })
      .sort({ createdAt: -1 }) // Newest first
      .lean();
    return projects;
  }

  /**
   * Get a single project by ID
   */
  async findOne(projectId: string, talentId: string) {
    const project = await this.portfolioModel.findById(projectId).lean();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.talentId !== talentId) {
      throw new ForbiddenException('You do not have permission to access this project');
    }

    return project;
  }

  /**
   * Update a project
   */
  async update(
    projectId: string,
    talentId: string,
    updateDto: UpdatePortfolioDto,
    mediaFile?: Express.Multer.File,
  ) {
    const project = await this.portfolioModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.talentId !== talentId) {
      throw new ForbiddenException('You do not have permission to update this project');
    }

    // Update fields
    if (updateDto.title !== undefined) {
      project.title = updateDto.title;
    }

    if (updateDto.role !== undefined) {
      project.role = updateDto.role;
    }

    if (updateDto.skills !== undefined) {
      project.skills = updateDto.skills;
    }

    if (updateDto.description !== undefined) {
      project.description = updateDto.description;
    }

    // Handle media file upload (replace existing if new file is provided)
    if (mediaFile) {
      const ext = extname(mediaFile.originalname).toLowerCase();
      const isImage = allowedImageExtensions.includes(ext);
      const isVideo = allowedVideoExtensions.includes(ext);

      if (!isImage && !isVideo) {
        throw new BadRequestException('Invalid media file type');
      }

      // Store path relative to uploads folder
      let relativePath = mediaFile.path.replace(/\\/g, '/');
      // Remove leading ./ if present
      if (relativePath.startsWith('./')) {
        relativePath = relativePath.substring(2);
      }
      project.media = relativePath;
      project.mediaType = isImage ? 'image' : 'video';
    }

    await project.save();
    return project.toObject();
  }

  /**
   * Delete a project
   */
  async remove(projectId: string, talentId: string) {
    const project = await this.portfolioModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.talentId !== talentId) {
      throw new ForbiddenException('You do not have permission to delete this project');
    }

    await this.portfolioModel.findByIdAndDelete(projectId);
    return { message: 'Project deleted successfully' };
  }
}


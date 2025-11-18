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
import { MediaItemDto } from './dto/media-item.dto';
import { MediaItem } from './schemas/media-item.schema';
import { extname } from 'path';

// Allowed extensions for portfolio media
const allowedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const allowedVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const allowedPdfExtensions = ['.pdf'];

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
    mediaFiles?: Express.Multer.File[],
  ) {
    const projectData: any = {
      talentId,
      title: createDto.title,
      skills: createDto.skills || [],
      media: [],
    };

    if (createDto.role) {
      projectData.role = createDto.role;
    }

    if (createDto.description) {
      projectData.description = createDto.description;
    }

    if (createDto.projectLink) {
      projectData.projectLink = createDto.projectLink;
    }

    // Process uploaded files
    if (mediaFiles && mediaFiles.length > 0) {
      const mediaItems: MediaItem[] = [];
      
      for (const file of mediaFiles) {
        const ext = extname(file.originalname).toLowerCase();
        const isImage = allowedImageExtensions.includes(ext);
        const isVideo = allowedVideoExtensions.includes(ext);
        const isPdf = allowedPdfExtensions.includes(ext);

        if (!isImage && !isVideo && !isPdf) {
          throw new BadRequestException(`Invalid file type: ${ext}. Only images, videos, and PDFs are allowed`);
        }

        // Store path relative to uploads folder
        let relativePath = file.path.replace(/\\/g, '/');
        if (relativePath.startsWith('./')) {
          relativePath = relativePath.substring(2);
        }

        const mediaItem: MediaItem = {
          type: isImage ? 'image' : isVideo ? 'video' : 'pdf',
          url: relativePath,
          title: file.originalname,
        };

        mediaItems.push(mediaItem);
      }

      projectData.media = mediaItems;
    }

    // Process media items from DTO (for external links or existing media)
    if (createDto.media && createDto.media.length > 0) {
      const existingMedia = projectData.media || [];
      for (const mediaDto of createDto.media) {
        const mediaItem: MediaItem = {
          type: mediaDto.type,
          url: mediaDto.url,
          title: mediaDto.title,
          externalLink: mediaDto.externalLink,
        };
        existingMedia.push(mediaItem);
      }
      projectData.media = existingMedia;
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
    mediaFiles?: Express.Multer.File[],
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

    if (updateDto.projectLink !== undefined) {
      project.projectLink = updateDto.projectLink;
    }

    // Handle media updates
    if (updateDto.media !== undefined) {
      // Replace entire media array if provided
      project.media = updateDto.media.map((mediaDto) => ({
        type: mediaDto.type,
        url: mediaDto.url,
        title: mediaDto.title,
        externalLink: mediaDto.externalLink,
      }));
    }

    // Process new uploaded files (append to existing media)
    if (mediaFiles && mediaFiles.length > 0) {
      const existingMedia = project.media || [];
      
      for (const file of mediaFiles) {
        const ext = extname(file.originalname).toLowerCase();
        const isImage = allowedImageExtensions.includes(ext);
        const isVideo = allowedVideoExtensions.includes(ext);
        const isPdf = allowedPdfExtensions.includes(ext);

        if (!isImage && !isVideo && !isPdf) {
          throw new BadRequestException(`Invalid file type: ${ext}. Only images, videos, and PDFs are allowed`);
        }

        let relativePath = file.path.replace(/\\/g, '/');
        if (relativePath.startsWith('./')) {
          relativePath = relativePath.substring(2);
        }

        const mediaItem: MediaItem = {
          type: isImage ? 'image' : isVideo ? 'video' : 'pdf',
          url: relativePath,
          title: file.originalname,
        };

        existingMedia.push(mediaItem);
      }

      project.media = existingMedia;
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


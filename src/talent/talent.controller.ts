import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { TalentService } from './talent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  AnyFilesInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Controller('talent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('talent')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  // --------------------------------------------------------
  // 📌 1) Lire le profil du talent connecté
  // --------------------------------------------------------
  @Get('me')
  async getProfile(@Req() req) {
    return await this.talentService.getProfile(req.user.id);
  }

  // --------------------------------------------------------
  // 📌 2) Compléter le profil (étape 2 après signup)
  // --------------------------------------------------------
  @Post('complete-profile')
  @UseInterceptors(AnyFilesInterceptor())
  async completeProfile(
    @Req() req,
    @Body() dto: CompleteProfileDto,
  ) {
    return await this.talentService.completeProfile(req.user.id, dto);
  }

  // --------------------------------------------------------
  // 📌 3) Upload photo de profil
  // --------------------------------------------------------
  @Post('upload-profile')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profile',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadProfileImage(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imageUrl = `/uploads/profile/${file.filename}`;
    return await this.talentService.updateProfileImage(req.user.id, imageUrl);
  }

  // --------------------------------------------------------
  // 📌 4) Upload bannière
  // --------------------------------------------------------
  @Post('upload-banner')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/banner',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadBanner(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const bannerUrl = `/uploads/banner/${file.filename}`;
    return await this.talentService.updateBannerImage(req.user.id, bannerUrl);
  }

  // --------------------------------------------------------
  // 📌 5) Upload images de portfolio (plusieurs images)
  // --------------------------------------------------------
  @Post('upload-portfolio')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads/portfolio',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadPortfolioImages(
    @Req() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const imageUrls = files.map(
      (file) => `/uploads/portfolio/${file.filename}`,
    );
    return await this.talentService.addPortfolioImages(
      req.user.id,
      imageUrls,
    );
  }

  // --------------------------------------------------------
  // 📌 6) Supprimer une image de portfolio
  // --------------------------------------------------------
  @Post('delete-portfolio')
  async deletePortfolioImage(@Req() req, @Body('imageUrl') imageUrl: string) {
    return await this.talentService.removePortfolioImage(
      req.user.id,
      imageUrl,
    );
  }
}

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { TalentService } from './talent.service';
import { UpdateTalentDto } from './dto/update-talent.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('talent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('talent')
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  // 🔍 Lire le profil du talent connecté
  @Get('me')
  async getProfile(@Req() req) {
    return this.talentService.getProfile(req.user.id);
  }

  // ✏️ Modifier les coordonnées du talent


  // 📸 Upload de la photo de profil
  @Post('upload-profile')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profile',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadProfileImage(@Req() req, @UploadedFile() file: Express.Multer.File) {
    const imageUrl = `/uploads/profile/${file.filename}`;
    return this.talentService.updateProfileImage(req.user.id, imageUrl);


  }

  // 🖼️ Upload de la bannière
  @Post('upload-banner')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/banner',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadBanner(@Req() req, @UploadedFile() file: Express.Multer.File) {
    const bannerUrl = `/uploads/banner/${file.filename}`;
return this.talentService.updateBannerImage(req.user.id, bannerUrl);
  }
}

import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Get, Request } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {


    constructor(private readonly userService: UserService) {}

  // 🔒 Retourne le profil de l'utilisateur connecté
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    const user = await this.userService.findById(req.user.id);
    return user;
  }
}

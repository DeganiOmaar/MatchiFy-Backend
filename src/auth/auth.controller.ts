import { Body, Controller, Post } from '@nestjs/common';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { AuthService } from './auth.service';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Controller('auth')
export class AuthController {


     constructor(private authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    console.log('✅ /auth/signup route triggered');
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

// Étape 1 : envoyer l'email de reset
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.sendResetPasswordEmail(dto);
  }

  // Étape 2 : réinitialiser avec le token reçu par mail
  @Post('reset-password')
  async resetPassword(@Body() dto: UpdatePasswordDto) {
    return this.authService.updatePassword(dto);
  }
}

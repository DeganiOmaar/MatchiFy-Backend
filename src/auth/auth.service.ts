import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {


    constructor(private userService: UserService, private jwt: JwtService) {}

async signup(dto: SignupDto) {
  const { email, password, name, role } = dto;

  const existing = await this.userService.findByEmail(email);
  if (existing) throw new BadRequestException('Email already exists');

  const hashed = await bcrypt.hash(password, 10);

  const user = await this.userService.create({
    email,
    password: hashed,
    name,
    role: role || 'talent', // ✅ si rien n’est envoyé, c’est un Talent
  });

  const token = this.jwt.sign({ id: user._id, email: user.email, role: user.role });
  return { user: this.clean(user), token };
}


  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwt.sign({ id: user._id, email: user.email, role: user.role });
    return { user: this.clean(user), token };
  }

async resetPassword(dto: ResetPasswordDto) {
  const { email, newPassword } = dto;
  const user = await this.userService.findByEmail(email);

  if (!user) {
    throw new BadRequestException('User not found');
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await this.userService.save(user);

  return { message: 'Password reset successfully' };
}


  private clean(user: any) {
    const { password, ...rest } = user.toObject();
    return rest;
  }
}

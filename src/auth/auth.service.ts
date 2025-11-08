import { 
  BadRequestException, 
  Injectable, 
  NotFoundException, 
  UnauthorizedException 
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwt: JwtService,
    private readonly mailerService: MailerService
  ) {}

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

  private clean(user: any) {
    const { password, ...rest } = user.toObject();
    return rest;
  }

  // 🧠 Étape 1 : Envoi de l'email avec lien + token affiché proprement
  async sendResetPasswordEmail(dto: ResetPasswordDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) throw new NotFoundException('Email non reconnu');

    // Génération d’un token JWT temporaire
    const token = this.jwt.sign(
      { userId: user.id, email: user.email },
      { expiresIn: '15m' }
    );

    // Lien de réinitialisation (deep link pour ton app Android)
    const resetLink = `matchify://new-password?token=${token}`;

    // ✅ Envoi d’un mail HTML stylé
    await this.mailerService.sendMail({
      to: user.email,
      subject: '🔐 Réinitialisation de votre mot de passe - MatchiFy',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f5f8fb; padding: 40px; text-align: center;">
          <div style="background-color: #ffffff; border-radius: 12px; max-width: 500px; margin: 0 auto; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            
            <h2 style="color: #1B224D;">🔒 Réinitialisation de votre mot de passe</h2>
            <p style="color: #333;">Bonjour <strong>${user.name || ''}</strong>,</p>
            <p style="color: #555; line-height: 1.5;">
              Vous avez demandé la réinitialisation de votre mot de passe sur <strong>MatchiFy</strong>.
              Vous pouvez le faire de deux façons :
            </p>

            <div style="margin: 25px 0;">
              <a href="${resetLink}" target="_blank"
                style="background-color: #1B224D; color: white; text-decoration: none;
                padding: 12px 25px; border-radius: 8px; font-weight: bold; display: inline-block;">
                Réinitialiser mon mot de passe
              </a>
            </div>

            <p style="color: #666;">Ou copiez ce code et collez-le dans l’application :</p>

            <div style="background-color: #F3F4F6; border-radius: 8px; padding: 15px; margin: 10px 0;
                        font-family: monospace; color: #1B224D; word-break: break-all;">
              ${token}
            </div>

            <p style="color: #888; font-size: 14px; margin-top: 15px;">
              ⚠️ Ce code est valable <strong>15 minutes</strong>.
            </p>

            <hr style="margin: 25px 0; border: none; height: 1px; background-color: #eee;" />

            <p style="font-size: 12px; color: #999;">
              Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email.
            </p>

            <p style="font-size: 13px; color: #1B224D; font-weight: bold;">– L’équipe MatchiFy 💙</p>
          </div>
        </div>
      `,
    });

    return { success: true, message: 'Email de réinitialisation envoyé.' };
  }

  // 🧠 Étape 2 : Réinitialisation du mot de passe via token
  async updatePassword(dto: UpdatePasswordDto) {
    try {
      // Vérifie et décode le token JWT
      const decoded = this.jwt.verify(dto.token);
      const user = await this.userService.findByEmail(decoded.email);
      if (!user) throw new UnauthorizedException('Token invalide ou expiré.');

      // Hasher le nouveau mot de passe
      const hashed = await bcrypt.hash(dto.newPassword, 10);
      await this.userService.updatePassword(user.id, hashed);

      return { success: true, message: 'Mot de passe mis à jour avec succès.' };
    } catch (e) {
      throw new UnauthorizedException('Token invalide ou expiré.');
    }
  }
}

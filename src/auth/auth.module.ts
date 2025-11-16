import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from 'src/common/services/email.service';
import { Talent } from 'src/talent/schemas/talent.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { TalentSchema } from 'src/talent/schemas/talent.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';
@Module({
  imports: [
    UserModule,
    ConfigModule,
   
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // ✅ JWT configuration dynamique avec .env
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES') ?? '7d' },
      }),
    }),

 
  ],
  providers: [AuthService, JwtStrategy, EmailService],
  controllers: [AuthController],
  exports: [JwtStrategy, JwtModule],
})
export class AuthModule {}
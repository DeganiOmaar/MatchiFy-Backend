import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { TalentModule } from './talent/talent.module';
import { RecruiterModule } from './recruiter/recruiter.module';
import { MissionsModule } from './missions/missions.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { SkillModule } from './skill/skill.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ConversationsModule } from './conversations/conversations.module';
import { FavoritesModule } from './favorites/favorites.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    
    
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),


    AuthModule ,
    UserModule,
    TalentModule,
    RecruiterModule,
    MissionsModule,
    PortfolioModule,
    SkillModule,
    ProposalsModule,
    ConversationsModule,
    FavoritesModule,
    AlertsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

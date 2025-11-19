import { Module } from '@nestjs/common';
import { TalentController } from './talent.controller';
import { TalentService } from './talent.service';
import { UserModule } from 'src/user/user.module';
import { SkillModule } from '../skill/skill.module';

@Module({
  imports: [UserModule, SkillModule],
  controllers: [TalentController],
  providers: [TalentService]
})
export class TalentModule {}

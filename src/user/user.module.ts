import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UsersTalentsController } from './users-talents.controller';
import { User, UserSchema } from './schemas/user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
    imports: [
      MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
      PortfolioModule,
    ],
  providers: [UserService],
  controllers: [UserController, UsersTalentsController],
  exports: [UserService],
})
export class UserModule {}

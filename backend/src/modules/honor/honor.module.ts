import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HonorController } from './honor.controller';
import { HonorService } from './honor.service';
import { HonorLevel } from '../../entities/honor-level.entity';
import { Achievement } from '../../entities/achievement.entity';
import { UserAchievement } from '../../entities/user-achievement.entity';
import { User } from '../../entities/user.entity';
import { FocusSession } from '../../entities/focus-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HonorLevel, Achievement, UserAchievement, User, FocusSession])],
  controllers: [HonorController],
  providers: [HonorService],
  exports: [HonorService],
})
export class HonorModule {}

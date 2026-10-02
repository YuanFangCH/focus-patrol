import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ProcessManagerService } from './process-manager.service';
import { LocalIpGuard } from './local-ip.guard';
import { TrackModule } from '../track/track.module';
import { PatrolModule } from '../patrol/patrol.module';
import { User } from '../../entities/user.entity';
import { FocusSession } from '../../entities/focus-session.entity';
import { PatrolRecord } from '../../entities/patrol-record.entity';
import { ViolationSnapshot } from '../../entities/violation-snapshot.entity';
import { Friendship } from '../../entities/friendship.entity';
import { Notification } from '../../entities/notification.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { UserAchievement } from '../../entities/user-achievement.entity';
import { HonorLevel } from '../../entities/honor-level.entity';
import { Achievement } from '../../entities/achievement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, FocusSession, PatrolRecord, ViolationSnapshot, Friendship,
      Notification, RefreshToken, UserAchievement, HonorLevel, Achievement,
    ]),
    TrackModule,
    PatrolModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, ProcessManagerService, LocalIpGuard],
})
export class AdminModule {}

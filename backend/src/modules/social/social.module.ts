import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { Friendship } from '../../entities/friendship.entity';
import { User } from '../../entities/user.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship, User]), NotificationModule],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}

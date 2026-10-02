import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TrackService } from './track.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { PingDto, OnlineQueryDto } from './dto/track.dto';

@Controller('track')
export class TrackController {
  constructor(private readonly track: TrackService) {}

  /** 心跳 */
  @Post('ping')
  ping(@CurrentUser() user: AuthUser, @Body() dto: PingDto) {
    return this.track.ping(user.id, dto.sessionId);
  }

  /** 离开 */
  @Post('leave')
  leave(@CurrentUser() user: AuthUser) {
    return this.track.leave(user.id);
  }

  /** 查询在线状态(userIds 逗号分隔) */
  @Get('online')
  online(@CurrentUser() user: AuthUser, @Query() q: OnlineQueryDto) {
    const ids = (q.userIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.track.onlineStatus(ids);
  }
}

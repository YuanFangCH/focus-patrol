import {
  Body, Controller, Get, Param, Post, Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { NotificationListQueryDto, NotificationIdParamDto } from './dto/notification.dto';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  /** 通知列表 */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: NotificationListQueryDto) {
    const limit = Number(q.limit) || 20;
    const offset = Number(q.offset) || 0;
    return this.notifications.list(user.id, Math.min(limit, 100), Math.max(offset, 0));
  }

  /** 单条已读 */
  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param() p: NotificationIdParamDto) {
    return this.notifications.markRead(user.id, p.id);
  }

  /** 全部已读 */
  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}

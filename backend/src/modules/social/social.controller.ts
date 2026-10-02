import {
  Body, Controller, Delete, Get, Param, Post,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RequestFriendDto, FriendshipIdParamDto, FriendIdParamDto } from './dto/social.dto';

@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  /** 好友申请列表 */
  @Get('requests')
  requests(@CurrentUser() user: AuthUser) {
    return this.social.requests(user.id);
  }

  /** 发起好友申请 */
  @Post('requests')
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestFriendDto) {
    return this.social.request(user.id, dto.userId);
  }

  /** 接受申请 */
  @Post('requests/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param() p: FriendshipIdParamDto) {
    return this.social.accept(user.id, p.id);
  }

  /** 拒绝申请 */
  @Post('requests/:id/reject')
  reject(@CurrentUser() user: AuthUser, @Param() p: FriendshipIdParamDto) {
    return this.social.reject(user.id, p.id);
  }

  /** 好友列表 */
  @Get('friends')
  friends(@CurrentUser() user: AuthUser) {
    return this.social.friends(user.id);
  }

  /** 删除好友 */
  @Delete('friends/:userId')
  remove(@CurrentUser() user: AuthUser, @Param() p: FriendIdParamDto) {
    return this.social.remove(user.id, p.userId);
  }
}

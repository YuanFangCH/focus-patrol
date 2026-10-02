import { Body, Controller, HttpCode, Post, Headers, UseGuards, Req } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { getClientIp } from '../../common/utils/get-client-ip';
import { LoginByUidDto, RefreshDto, LogoutDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 唯一 uid 登录(限流 10 次/分,防 uid 暴力枚举) */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginByUidDto, @Headers('user-agent') ua?: string, @Req() req?: Request) {
    return this.auth.loginByUid(dto.uid, ua, dto.rememberIp, req ? getClientIp(req) : undefined);
  }

  /** 基于 IP 绑定的免登录(命中绑定则自动登录) */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('ip-login')
  @HttpCode(200)
  ipLogin(@Req() req: Request) {
    return this.auth.loginByIp(getClientIp(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') ua?: string) {
    return this.auth.refreshTokens(dto.refreshToken, ua);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }
}

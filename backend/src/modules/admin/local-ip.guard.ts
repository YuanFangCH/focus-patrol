import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

/**
 * 本机/局域网 IP 白名单守卫
 * 用于管理接口(如 /api/admin/*),只允许本机或局域网请求调用。
 */
@Injectable()
export class LocalIpGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = (req.ip ?? '').replace('::ffff:', '');
    const allowed = new Set([
      '127.0.0.1',
      '::1',
      'localhost',
    ]);
    // 局域网: 192.168.x.x / 10.x.x.x / 172.16-31.x.x
    const isLan =
      /^192\.168\./.test(ip) ||
      /^10\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
    if (allowed.has(ip) || isLan) return true;
    throw new ForbiddenException('管理接口仅限本机/局域网访问');
  }
}

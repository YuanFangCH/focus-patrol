import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 全局默认守卫;接口用 @Public() 放行 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const handler = context.getHandler();
    const cls = context.getClass();
    const isPublic =
      Reflect.getMetadata('isPublic', handler) ||
      Reflect.getMetadata('isPublic', cls);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

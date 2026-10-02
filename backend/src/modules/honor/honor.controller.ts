import { Controller, Get } from '@nestjs/common';
import { HonorService } from './honor.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('honor')
export class HonorController {
  constructor(private readonly honor: HonorService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.honor.me(user.id);
  }

  @Public()
  @Get('levels')
  listLevels() {
    return this.honor.listLevels();
  }
}

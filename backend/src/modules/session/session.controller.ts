import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SessionService } from './session.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateSessionDto, EndSessionDto, ListQueryDto } from './dto/session.dto';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user.id, dto.durationMinutes, dto.mode ?? 'off', dto.type);
  }

  @Post(':id/end')
  end(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EndSessionDto) {
    return this.sessions.end(user.id, id, dto.actualSeconds);
  }

  @Post(':id/interrupt')
  interrupt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.interrupt(user.id, id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListQueryDto) {
    return this.sessions.list(user.id, q.status, q.page, q.size);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.detail(user.id, id);
  }
}

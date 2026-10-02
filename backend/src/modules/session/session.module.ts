import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { FocusSession } from '../../entities/focus-session.entity';
import { PatrolRecord } from '../../entities/patrol-record.entity';
import { HonorModule } from '../honor/honor.module';

@Module({
  imports: [TypeOrmModule.forFeature([FocusSession, PatrolRecord]), HonorModule],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}

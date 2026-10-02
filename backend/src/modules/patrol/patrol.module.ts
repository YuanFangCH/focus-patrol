import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { PatrolController } from './patrol.controller';
import { PatrolService } from './patrol.service';
import { SnapshotCleanupTask } from './snapshot-cleanup.task';
import { PatrolRecord } from '../../entities/patrol-record.entity';
import { ViolationSnapshot } from '../../entities/violation-snapshot.entity';
import { FocusSession } from '../../entities/focus-session.entity';
import { SpotCheck } from '../../entities/spot-check.entity';
import { AIVisionRouter } from '../../vision/ai-vision.router';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { TrackModule } from '../track/track.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatrolRecord, ViolationSnapshot, FocusSession, SpotCheck]),
    HttpModule,
    AiConfigModule,
    TrackModule,
  ],
  controllers: [PatrolController],
  providers: [PatrolService, AIVisionRouter, SnapshotCleanupTask],
  exports: [PatrolService],
})
export class PatrolModule {}

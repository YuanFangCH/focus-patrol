import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PatrolService } from '../patrol/patrol.service';

/** 合规:违纪快照 30 天自动清理 */
@Injectable()
export class SnapshotCleanupTask {
  private readonly logger = new Logger('SnapshotCleanup');
  constructor(private readonly patrols: PatrolService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handle() {
    const { deleted } = await this.patrols.cleanupExpiredSnapshots();
    if (deleted > 0) this.logger.log(`每日清理完成,删除过期快照 ${deleted} 条`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsage } from '../../entities/ai-usage.entity';

/** 视觉模型调用后的用量记录 */
export interface UsageRecord {
  provider: string;
  model: string;
  tokens?: number;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger('AiUsage');

  constructor(
    @InjectRepository(AiUsage) private readonly usages: Repository<AiUsage>,
  ) {}

  private today(): string {
    const d = new Date();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  /** 记录一次视觉判定调用(按 provider+date upsert 累计) */
  async record(rec: UsageRecord) {
    if (!rec.provider) return;
    const date = this.today();
    const tokens = rec.tokens && rec.tokens > 0 ? rec.tokens : 0;
    const existing = await this.usages.findOne({ where: { provider: rec.provider, date } });
    if (existing) {
      await this.usages.update({ id: existing.id }, {
        callCount: existing.callCount + 1,
        tokenCount: existing.tokenCount + tokens,
        model: rec.model || existing.model,
      });
    } else {
      await this.usages.save(
        this.usages.create({
          provider: rec.provider,
          model: rec.model || 'unknown',
          date,
          callCount: 1,
          tokenCount: tokens,
        }),
      );
    }
  }

  /** 用量统计: 每 provider 今日 + 近 N 天累计 */
  async stats(days = 7) {
    const all = await this.usages.find();
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceStr = `${since.getFullYear()}-${`${since.getMonth() + 1}`.padStart(2, '0')}-${`${since.getDate()}`.padStart(2, '0')}`;
    const today = this.today();

    // 按 provider 聚合
    const map = new Map<string, { model: string; today: { calls: number; tokens: number }; week: { calls: number; tokens: number } }>();
    for (const u of all) {
      const row = map.get(u.provider) ?? { model: u.model, today: { calls: 0, tokens: 0 }, week: { calls: 0, tokens: 0 } };
      if (u.date >= sinceStr) {
        row.week.calls += u.callCount;
        row.week.tokens += u.tokenCount;
        if (u.date === today) {
          row.today.calls += u.callCount;
          row.today.tokens += u.tokenCount;
        }
      }
      map.set(u.provider, row);
    }
    return Array.from(map.entries()).map(([provider, v]) => ({
      provider,
      model: v.model,
      today: v.today,
      week: v.week,
    }));
  }
}

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
} from 'typeorm';

/**
 * 视觉模型用量统计(按日聚合)
 * 每次 AI 视觉判定调用后 upsert: callCount+1, tokenCount+token。
 * sql.js 内存库重启清零, 按日聚合可接受, 无需清理策略。
 */
@Entity('ai_usage')
@Index('idx_au_provider_date', ['provider', 'date'])
export class AiUsage {
  @PrimaryGeneratedColumn()
  id: number;

  /** 对应 AiProvider: volcengine | qwen | glm | mock */
  @Column({ type: 'varchar', length: 20 })
  provider: string;

  /** 实际使用的模型名(如 qwen-vl-plus) */
  @Column({ type: 'varchar', length: 100 })
  model: string;

  /** 聚合日 'YYYY-MM-DD' */
  @Column({ name: 'usage_date', type: 'varchar', length: 10 })
  date: string;

  @Column({ name: 'call_count', type: 'int', default: 0 })
  callCount: number;

  @Column({ name: 'token_count', type: 'int', default: 0 })
  tokenCount: number;
}

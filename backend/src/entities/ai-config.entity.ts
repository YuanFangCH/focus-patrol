import {
  Entity, PrimaryGeneratedColumn, Column,
} from 'typeorm';

@Entity('ai_configs')
export class AiConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  provider: 'volcengine' | 'qwen' | 'glm';

  @Column({ name: 'model_name', type: 'varchar', length: 100 })
  modelName: string;

  @Column({ name: 'api_key_cipher', type: 'varchar', length: 500, nullable: true })
  apiKeyCipher?: string;

  @Column({ name: 'base_url', type: 'varchar', length: 255, nullable: true })
  baseUrl?: string;

  @Column({ type: 'int', default: 1 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'daily_quota', type: 'int', default: 200 })
  dailyQuota: number;
}

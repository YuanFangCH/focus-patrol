import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * 突击检查任务
 * 管理员发起 → 落 pending 任务 → 用户端轮询认领 → 抓帧上传 AI 判定 → done + 存压缩图
 * 图存 uploads/spot/{userId}/{id}.jpg(objectKey), 管理员可查看/删除
 */
@Entity('spot_checks')
@Index('idx_sc_user_status', ['userId', 'status'])
export class SpotCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: 'pending' | 'done';

  @Column({ type: 'varchar', length: 20, nullable: true })
  result?: 'focus' | 'distracted' | 'away' | 'unknown';

  @Column({ type: 'numeric', precision: 4, scale: 3, nullable: true })
  confidence?: number;

  @Column({ name: 'object_key', type: 'varchar', length: 500, nullable: true })
  objectKey?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  source?: 'camera' | 'screen';

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}

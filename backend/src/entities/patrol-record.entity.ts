import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('patrol_records')
@Index('idx_pr_session', ['sessionId'])
@Index('idx_pr_user_result', ['userId', 'result'])
@Index('idx_pr_user_scheduled', ['userId', 'scheduledAt'])
export class PatrolRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  source: 'camera' | 'screen';

  @Column({ type: 'varchar', length: 12 })
  result: 'focus' | 'distracted' | 'away' | 'unknown';

  @Column({ type: 'numeric', precision: 4, scale: 3, nullable: true })
  confidence?: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  @Column({ name: 'is_violation', type: 'boolean', default: false })
  isViolation: boolean;

  @Column({ name: 'snapshot_url', type: 'varchar', length: 500, nullable: true })
  snapshotUrl?: string;

  @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true })
  failureReason?: string;

  @Column({ name: 'scheduled_at', type: 'datetime' })
  scheduledAt: Date;

  @Column({ name: 'judged_at', type: 'datetime', nullable: true })
  judgedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}

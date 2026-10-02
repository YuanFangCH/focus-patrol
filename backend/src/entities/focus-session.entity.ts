import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('focus_sessions')
@Index('idx_fs_user_status', ['userId', 'status'])
@Index('idx_fs_user_started', ['userId', 'startedAt'])
export class FocusSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  status: 'running' | 'completed' | 'interrupted';

  @Column({ type: 'varchar', length: 10, default: 'focus' })
  type: 'focus' | 'break';

  @Column({ type: 'varchar', length: 10, default: 'off' })
  mode: 'off' | 'camera' | 'screen';

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ name: 'actual_seconds', type: 'int', default: 0 })
  actualSeconds: number;

  @Column({ name: 'patrol_count', type: 'int', default: 0 })
  patrolCount: number;

  @Column({ name: 'violation_count', type: 'int', default: 0 })
  violationCount: number;

  @Column({ type: 'smallint', nullable: true })
  score?: number;

  @Column({ name: 'started_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true })
  endedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}

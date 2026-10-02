import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('sms_codes')
@Index('idx_sms_phone_purpose_created', ['phone', 'purpose', 'createdAt'])
export class SmsCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ type: 'varchar', length: 20 })
  purpose: 'login' | 'delete_account';

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt?: Date;

  @Column({ name: 'attempt_count', type: 'smallint', default: 0 })
  attemptCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}

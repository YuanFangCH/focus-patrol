import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique,
} from 'typeorm';

@Entity('friendships')
@Unique('uq_friends', ['requesterId', 'addresseeId'])
@Index('idx_fs_addressee_status', ['addresseeId', 'status'])
export class Friendship {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId: string;

  @Column({ name: 'addressee_id', type: 'uuid' })
  addresseeId: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: 'pending' | 'accepted' | 'rejected';

  @Column({ name: 'requested_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  requestedAt: Date;

  @Column({ name: 'responded_at', type: 'datetime', nullable: true })
  respondedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}

import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Achievement } from './achievement.entity';

@Entity('user_achievements')
export class UserAchievement {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'achievement_id', type: 'int' })
  achievementId: number;

  @ManyToOne(() => Achievement, { eager: false })
  @JoinColumn({ name: 'achievement_id' })
  achievement?: Achievement;

  @CreateDateColumn({ name: 'unlocked_at', type: 'datetime' })
  unlockedAt: Date;
}

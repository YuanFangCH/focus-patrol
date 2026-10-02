import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('users')
@Index('idx_users_phone', ['phone'])
@Index('idx_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email?: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash?: string;

  @Column({ type: 'varchar', length: 50, default: '督学员' })
  nickname: string;

  /** 唯一登录标识(8 位短码,管理员经 create-user 脚本生成;旧账号为 NULL 不可登录) */
  @Column({ type: 'varchar', length: 8, unique: true, nullable: true })
  uid?: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ name: 'is_guest', type: 'boolean', default: false })
  isGuest: boolean;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role: string;

  @Column({ type: 'smallint', default: 1 })
  status: number;

  @Column({ name: 'honor_level_id', type: 'int', nullable: true })
  honorLevelId?: number;

  @Column({ name: 'honor_exp', type: 'int', default: 0 })
  honorExp: number;

  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion: number;

  @Column({ name: 'last_active_at', type: 'datetime', nullable: true })
  lastActiveAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}

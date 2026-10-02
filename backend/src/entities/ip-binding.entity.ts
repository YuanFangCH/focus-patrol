import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * IP 绑定免登录: 用户登录时勾选"记住这台设备IP"后,
 * 把当前客户端 IP 绑到 userId; 同 IP 再次访问(无 token)时自动免登。
 */
@Entity('ip_bindings')
@Index('idx_ib_user', ['userId'])
export class IpBinding {
  @PrimaryGeneratedColumn()
  id: string;

  /** 客户端 IP(IPv6 最长 45 字符, 唯一) */
  @Column({ type: 'varchar', length: 45, unique: true })
  ip: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;
}

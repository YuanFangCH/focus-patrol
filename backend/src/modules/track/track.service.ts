import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

/**
 * 在线心跳模块(SQLite 降级版)
 *
 * 方案文档设计用 Redis(online:{userId} TTL 30s)。当前环境无 Redis,
 * 用进程内 Map + 时间戳实现等价语义:
 * - ping: 更新 lastSeen 时间戳,并刷新 user.last_active_at
 * - 在线判定: lastSeen 距今 < 30s
 * - leave: 清除记录
 * - 多实例运行时需换 Redis(TrackService 接口不变)
 */
@Injectable()
export class TrackService {
  private readonly logger = new Logger('Track');
  /** userId -> lastSeen(epoch ms) */
  private readonly onlineMap = new Map<string, number>();
  // 90s: 贴合前端 60s 心跳, 留 1.5x 余量避免网络抖动误离线
  private readonly TTL_MS = 90_000;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** 心跳: 刷新在线时间 */
  async ping(userId: string, sessionId?: string) {
    const now = Date.now();
    this.onlineMap.set(userId, now);
    // 异步刷新 last_active_at(失败不影响心跳)
    try {
      await this.users.update({ id: userId }, { lastActiveAt: new Date(now) });
    } catch (e) {
      this.logger.warn(`刷新 last_active_at 失败: ${(e as Error).message}`);
    }
    return { online: this.cleanCount(), count: this.cleanCount(), sessionId: sessionId ?? null };
  }

  /** 离开: 清除在线记录 */
  async leave(userId: string) {
    this.onlineMap.delete(userId);
    return {};
  }

  /** 查询指定用户是否在线 */
  async onlineStatus(userIds: string[]) {
    const now = Date.now();
    this.sweep(now);
    const online: string[] = [];
    for (const id of userIds) {
      const last = this.onlineMap.get(id);
      if (last !== undefined && now - last < this.TTL_MS) online.push(id);
    }
    return { online };
  }

  /** 当前在线人数(清理过期后) */
  private cleanCount(): number {
    const now = Date.now();
    this.sweep(now);
    return this.onlineMap.size;
  }

  private sweep(now: number) {
    for (const [id, last] of this.onlineMap) {
      if (now - last >= this.TTL_MS) this.onlineMap.delete(id);
    }
  }
}

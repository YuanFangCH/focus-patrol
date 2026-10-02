import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { HonorLevel } from '../../entities/honor-level.entity';
import { Achievement } from '../../entities/achievement.entity';
import { UserAchievement } from '../../entities/user-achievement.entity';
import { User } from '../../entities/user.entity';
import { FocusSession } from '../../entities/focus-session.entity';

const LEVEL_SEED: Array<[number, string, number]> = [
  [1, '青铜学徒', 0],
  [2, '白银卫士', 100],
  [3, '黄金督学', 300],
  [4, '钻石督军', 800],
  [5, '王者', 2000],
];

const ACHIEVEMENT_SEED = [
  { code: 'first_session', name: '初试锋芒', description: '完成第一个专注会话' },
  { code: 'keep_7days', name: '七日之约', description: '连续 7 天完成专注' },
  { code: 'no_violation_10', name: '清白之身', description: '累计 10 次巡查零违纪' },
];

export interface ExpSettleResult {
  levelUp: {
    from: number;
    to: number;
    name: string;
  } | null;
  unlockedAchievements: Achievement[];
}

@Injectable()
export class HonorService implements OnModuleInit {
  private readonly logger = new Logger('Honor');
  constructor(
    @InjectRepository(HonorLevel) private readonly levels: Repository<HonorLevel>,
    @InjectRepository(Achievement) private readonly achievements: Repository<Achievement>,
    @InjectRepository(UserAchievement) private readonly userAchievements: Repository<UserAchievement>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(FocusSession) private readonly sessions: Repository<FocusSession>,
  ) {}

  async onModuleInit() {
    // 种子数据(幂等)
    for (const [id, name, minExp] of LEVEL_SEED) {
      const exists = await this.levels.findOne({ where: { id } });
      if (!exists) await this.levels.save({ id, name, minExp });
    }
    for (const a of ACHIEVEMENT_SEED) {
      const exists = await this.achievements.findOne({ where: { code: a.code } });
      if (!exists) await this.achievements.save(a);
    }
    this.logger.log('荣誉等级/勋章种子数据就绪');
  }

  /** 我的荣誉概览 */
  async me(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new Error('用户不存在');
    const levels = await this.levels.find({ order: { minExp: 'ASC' } });
    let level = levels[0];
    let next: HonorLevel | null = null;
    for (const l of levels) {
      if (user.honorExp >= l.minExp) level = l;
      if (l.minExp > user.honorExp) { next = l; break; }
    }
    const achievements = await this.userAchievements.find({
      where: { userId },
      relations: { achievement: true },
    });
    return {
      level,
      exp: user.honorExp,
      nextMinExp: next?.minExp ?? null,
      achievements: achievements.map((ua) => ua.achievement),
    };
  }

  async listLevels() {
    return this.levels.find({ order: { minExp: 'ASC' } });
  }

  /** 当前等级(按经验) */
  async currentLevel(exp: number): Promise<{ level: HonorLevel; next: HonorLevel | null }> {
    const levels = await this.levels.find({ order: { minExp: 'ASC' } });
    let level = levels[0];
    let next: HonorLevel | null = null;
    for (const l of levels) {
      if (exp >= l.minExp) level = l;
      if (l.minExp > exp) { next = l; break; }
    }
    return { level, next };
  }

  /**
   * 结算经验(供 SessionModule 接驳):
   * 1. 经验累加
   * 2. 检测升级(跨级一次算一次,返回最终 from/to)
   * 3. 成就解锁: first_session / no_violation_10 / keep_7days
   */
  async addExpAndSettle(
    userId: string,
    gained: number,
    context?: { completedSessions?: number; patrolsNoViolation?: number },
  ): Promise<ExpSettleResult> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return { levelUp: null, unlockedAchievements: [] };
    const before = await this.currentLevel(user.honorExp);
    await this.users.increment({ id: userId }, 'honorExp', gained);
    const afterUser = await this.users.findOne({ where: { id: userId } });
    if (!afterUser) return { levelUp: null, unlockedAchievements: [] };
    const after = await this.currentLevel(afterUser.honorExp);

    const levelUp =
      after.level.id > before.level.id
        ? { from: before.level.id, to: after.level.id, name: after.level.name }
        : null;

    const unlockedAchievements: Achievement[] = [];
    // 成就判定(有上下文才判断,避免额外查询)
    const completed = context?.completedSessions ?? (await this.sessions.count({ where: { userId, status: 'completed' } }));
    if (completed >= 1) {
      const a = await this.unlockAchievement(userId, 'first_session');
      if (a) unlockedAchievements.push(a);
    }
    if (context?.patrolsNoViolation !== undefined) {
      if (context.patrolsNoViolation >= 10) {
        const a = await this.unlockAchievement(userId, 'no_violation_10');
        if (a) unlockedAchievements.push(a);
      }
    }

    if (levelUp) this.logger.log(`用户 ${userId} 升级: Lv.${before.level.id} → Lv.${after.level.id} (${after.level.name})`);
    return { levelUp, unlockedAchievements };
  }

  /** 解锁成就(幂等),返回新解锁的成就 */
  private async unlockAchievement(userId: string, code: string): Promise<Achievement | null> {
    const achievement = await this.achievements.findOne({ where: { code } });
    if (!achievement) return null;
    const existing = await this.userAchievements.findOne({ where: { userId, achievementId: achievement.id } });
    if (existing) return null;
    await this.userAchievements.save({ userId, achievementId: achievement.id });
    this.logger.log(`用户 ${userId} 解锁成就: ${achievement.name}`);
    return achievement;
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, Like, In, QueryFailedError } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../../entities/user.entity';
import { FocusSession } from '../../entities/focus-session.entity';
import { PatrolRecord } from '../../entities/patrol-record.entity';
import { ViolationSnapshot } from '../../entities/violation-snapshot.entity';
import { Friendship } from '../../entities/friendship.entity';
import { Notification } from '../../entities/notification.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { UserAchievement } from '../../entities/user-achievement.entity';
import { HonorLevel } from '../../entities/honor-level.entity';
import { Achievement } from '../../entities/achievement.entity';
import { TrackService } from '../track/track.service';

/** uid 字符集:ABCDEFGHJKMNPQRSTUVWXYZ23456789(排除 0/O/1/I) */
const UID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(FocusSession) private readonly sessions: Repository<FocusSession>,
    @InjectRepository(PatrolRecord) private readonly patrols: Repository<PatrolRecord>,
    @InjectRepository(ViolationSnapshot) private readonly snapshots: Repository<ViolationSnapshot>,
    @InjectRepository(Friendship) private readonly friendships: Repository<Friendship>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(UserAchievement) private readonly userAchievements: Repository<UserAchievement>,
    @InjectRepository(HonorLevel) private readonly levels: Repository<HonorLevel>,
    @InjectRepository(Achievement) private readonly achievements: Repository<Achievement>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly track: TrackService,
  ) {}

  // ---------- 建号 ----------

  /**
   * 创建账号并生成唯一 uid(管理员经本机接口调用)
   */
  async createUsers(nickname: string, count = 1) {
    const n = Math.min(Math.max(count, 1), 100);
    const created: Array<{ id: string; uid: string; nickname: string }> = [];

    for (let i = 0; i < n; i++) {
      const uid = await this.genUniqueUid();
      const name = n > 1 ? `${nickname}${i + 1}` : nickname;
      const user = await this.users.save(
        this.users.create({ uid, nickname: name, role: 'user', status: 1 }),
      );
      created.push({ id: user.id, uid: uid!, nickname: name });
    }
    return { count: created.length, accounts: created };
  }

  // ---------- 用户列表 / 详情 ----------

  /** 用户列表(分页/搜索/状态过滤) */
  async listUsers(page = 1, size = 20, keyword?: string, status?: number) {
    const where: Record<string, unknown> = {};
    if (keyword) {
      where.uid = Like(`%${keyword}%`);
      // keyword 同时匹配 uid 和 nickname:用 QueryBuilder 更灵活
    }
    const qb = this.users.createQueryBuilder('u')
      .select([
        'u.id', 'u.uid', 'u.nickname', 'u.status', 'u.role',
        'u.honorLevelId', 'u.honorExp', 'u.isGuest', 'u.createdAt',
      ])
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * size)
      .take(size);
    if (status !== undefined) qb.andWhere('u.status = :status', { status });
    if (keyword) {
      qb.andWhere('(u.uid LIKE :kw OR u.nickname LIKE :kw)', { kw: `%${keyword}%` });
    }
    const [list, total] = await qb.getManyAndCount();
    // 等级名映射
    const levels = await this.levels.find();
    const levelMap = new Map(levels.map((l) => [l.id, l.name]));
    // 在线状态: 对当前页 ids 批量查询
    const onlineSet = new Set((await this.track.onlineStatus(list.map((u) => u.id))).online);
    return {
      list: list.map((u) => ({
        id: u.id,
        uid: u.uid ?? null,
        nickname: u.nickname,
        status: u.status,
        role: u.role,
        isGuest: u.isGuest,
        honorLevelId: u.honorLevelId ?? null,
        honorLevelName: u.honorLevelId ? levelMap.get(u.honorLevelId) ?? null : null,
        honorExp: u.honorExp,
        createdAt: u.createdAt,
        online: onlineSet.has(u.id),
      })),
      total,
      page,
      size,
    };
  }

  /** 用户聚合详情(统计 + 最近会话/违纪 + 勋章) */
  async userDetail(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const [sessions, completed, patrols, violations, snapshots, friends, notifications, unread, uaCount] =
      await Promise.all([
        this.sessions.count({ where: { userId: id } }),
        this.sessions.count({ where: { userId: id, status: 'completed' } }),
        this.patrols.count({ where: { userId: id } }),
        this.patrols.count({ where: { userId: id, isViolation: true } }),
        this.snapshots.count({ where: { userId: id } }),
        this.friendships.count({
          where: [
            { requesterId: id, status: 'accepted' },
            { addresseeId: id, status: 'accepted' },
          ],
        }),
        this.notifications.count({ where: { userId: id } }),
        this.notifications.count({ where: { userId: id, isRead: false } }),
        this.userAchievements.count({ where: { userId: id } }),
      ]);

    const [recentSessions, recentViolations, uaList, levels, levelName] = await Promise.all([
      this.sessions.find({ where: { userId: id }, order: { startedAt: 'DESC' }, take: 5 }),
      this.patrols.find({
        where: { userId: id, isViolation: true },
        order: { scheduledAt: 'DESC' },
        take: 5,
      }),
      this.userAchievements.find({ where: { userId: id }, relations: { achievement: true } }),
      this.levels.find({ order: { minExp: 'ASC' } }),
      user.honorLevelId ? this.levels.findOne({ where: { id: user.honorLevelId } }) : null,
    ]);

    // 当前等级(按经验兜底,与 honor/me 一致)
    let curLevel = levels[0];
    for (const l of levels) {
      if (user.honorExp >= l.minExp) curLevel = l;
    }
    // 在线状态
    const onlineSet = new Set((await this.track.onlineStatus([id])).online);

    return {
      user: {
        id: user.id,
        uid: user.uid ?? null,
        nickname: user.nickname,
        status: user.status,
        role: user.role,
        isGuest: user.isGuest,
        honorLevelId: user.honorLevelId ?? null,
        honorLevelName: levelName?.name ?? curLevel.name,
        honorExp: user.honorExp,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt ?? null,
        online: onlineSet.has(id),
      },
      counts: {
        sessions,
        completed,
        patrols,
        violations,
        snapshots,
        friends,
        notifications,
        unread,
        achievements: uaCount,
      },
      recentSessions,
      recentViolations,
      achievements: uaList.map((ua) => ua.achievement).filter(Boolean),
    };
  }

  /** 实时获取用户状态: 在线/当前状态/已开始时长/本会话巡查与违纪/最近违规 */
  async realtimeStatus(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const [onlineSet, live] = await Promise.all([
      this.track.onlineStatus([id]),
      this.sessions.findOne({
        where: { userId: id, status: 'running' },
        order: { startedAt: 'DESC' },
      }),
    ]);
    const isOnline = onlineSet.online.includes(id);
    const elapsedSeconds = live
      ? Math.floor((Date.now() - new Date(live.startedAt).getTime()) / 1000)
      : 0;

    let currentStatus: 'offline' | 'online-idle' | 'online-focus' | 'online-break' = 'offline';
    if (isOnline) {
      if (!live) currentStatus = 'online-idle';
      else currentStatus = live.type === 'break' ? 'online-break' : 'online-focus';
    }

    const recentViolations = await this.patrols.find({
      where: { userId: id, isViolation: true },
      order: { scheduledAt: 'DESC' },
      take: 3,
    });

    return {
      online: isOnline,
      currentStatus,
      elapsedSeconds,
      runningSession: live
        ? {
            id: live.id,
            mode: live.mode,
            type: live.type,
            status: live.status,
            durationMinutes: live.durationMinutes,
            actualSeconds: live.actualSeconds,
            hardLimitMinutes: live.durationMinutes,
            patrolCount: live.patrolCount,
            violationCount: live.violationCount,
            startedAt: live.startedAt,
          }
        : null,
      recentViolations,
      lastActiveAt: user.lastActiveAt ?? null,
    };
  }

  // ---------- 更新 ----------

  /** 改昵称 / 禁用启用;禁用时即时踢下线 */
  async updateUser(id: string, dto: { nickname?: string; status?: number }) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const patch: Partial<User> = {};
    if (dto.nickname !== undefined) patch.nickname = dto.nickname;
    if (dto.status !== undefined) {
      if (dto.status !== 0 && dto.status !== 1) throw new BadRequestException('status 仅支持 0/1');
      await this.applyStatusChange(user, dto.status);
      patch.status = dto.status;
    }
    if (Object.keys(patch).length) await this.users.update({ id }, patch);
    return { ok: true, status: dto.status !== undefined ? dto.status : user.status };
  }

  // ---------- 批量调整 ----------

  /**
   * 批量调整用户(nickname 批量改 / status→0 逐个踢下线)
   */
  async batchUpdateUsers(ids: string[], dto: { nickname?: string; status?: number }) {
    if (!dto.nickname && dto.status === undefined) {
      throw new BadRequestException('需提供 nickname 或 status');
    }
    const users = await this.users.find({ where: { id: In(ids) } });
    if (users.length === 0) throw new NotFoundException('未找到目标用户');

    if (dto.nickname !== undefined) {
      await this.users.update({ id: In(users.map((u) => u.id)) }, { nickname: dto.nickname });
    }
    if (dto.status !== undefined && dto.status !== 0 && dto.status !== 1) {
      throw new BadRequestException('status 仅支持 0/1');
    }
    if (dto.status === 0) {
      for (const u of users) {
        await this.applyStatusChange(u, 0);
      }
      await this.users.update({ id: In(users.map((u) => u.id)) }, { status: 0 });
    } else if (dto.status === 1) {
      await this.users.update({ id: In(users.map((u) => u.id)) }, { status: 1 });
    }
    return { ok: true, updated: users.length };
  }

  /** 禁用用户: tokenVersion++ 使旧 JWT 失效 + 吊销全部 refresh token */
  private async applyStatusChange(user: User, status: number) {
    if (status === 0) {
      await this.users.update({ id: user.id }, { tokenVersion: user.tokenVersion + 1 });
      await this.refreshTokens.update({ userId: user.id, revokedAt: undefined }, { revokedAt: new Date() });
    }
  }

  // ---------- 自定义 uid ----------

  /**
   * 设置/修改用户 uid。
   * uid 是唯一登录凭证: 修改后 tokenVersion++ 吊销 refresh, 强制用户用新 uid 重新登录。
   */
  async setUserUid(id: string, uid: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    this.validateUidFormat(uid);

    // 查重(排除自身)
    const dup = await this.users.findOne({ where: { uid } });
    if (dup && dup.id !== id) throw new BadRequestException(`uid ${uid} 已被占用`);

    try {
      await this.users.update({ id }, {
        uid,
        tokenVersion: user.tokenVersion + 1,
      });
    } catch (e) {
      if (e instanceof QueryFailedError && /unique/i.test((e as Error).message)) {
        throw new BadRequestException(`uid ${uid} 已被占用`);
      }
      throw e;
    }
    // 吊销该用户全部 refresh token
    await this.refreshTokens.update({ userId: id, revokedAt: undefined }, { revokedAt: new Date() });
    return { ok: true, uid };
  }

  // ---------- 删除(手动级联) ----------

  /**
   * 删除用户 + 手动级联清理全部关联数据(事务内)
   * SQLite 外键未启用,须按依赖顺序手动删除:
   * refresh_tokens → notifications → friendships → user_achievements
   * → violation_snapshots(+磁盘文件) → patrol_records → focus_sessions → users
   */
  async deleteUser(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    await this.dataSource.transaction(async (tx) => {
      await tx.delete(RefreshToken, { userId: id });
      await tx.delete(Notification, { userId: id });
      await tx.delete(Friendship, [
        { requesterId: id },
        { addresseeId: id },
      ]);
      await tx.delete(UserAchievement, { userId: id });
      // 快照:先查 objectKey,再删记录,事务外删磁盘文件
      const snaps = await tx.find(ViolationSnapshot, { where: { userId: id } });
      await tx.delete(ViolationSnapshot, { userId: id });
      await tx.delete(PatrolRecord, { userId: id });
      await tx.delete(FocusSession, { userId: id });
      await tx.delete(User, { id });

      // 删除磁盘快照目录(uploads/violations/{userId}/) 与 关联文件
      if (snaps.length > 0) {
        this.removeSnapshotFiles(snaps);
      }
    });

    return { ok: true };
  }

  // ---------- 统计(可选给面板顶部条) ----------

  async stats() {
    const [users, sessions, violations, snapshots] = await Promise.all([
      this.users.count(),
      this.sessions.count(),
      this.patrols.count({ where: { isViolation: true } }),
      this.snapshots.count(),
    ]);
    return { users, sessions, violations, snapshots };
  }

  // ---------- 内部工具 ----------

  /** 删除快照磁盘文件(沙箱 safe-delete 拦截风险,一律 try/catch) */
  private removeSnapshotFiles(snaps: ViolationSnapshot[]) {
    for (const s of snaps) {
      try {
        const p = path.resolve(process.env.UPLOAD_DIR || './uploads', s.objectKey.replace(/^\/+/, ''));
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch { /* 忽略删除失败 */ }
    }
    // 尝试删用户目录(可能已空)
    try {
      const dir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'violations', snaps[0].userId);
      if (fs.existsSync(dir)) fs.rmdirSync(dir);
    } catch { /* 忽略 */ }
  }

  /** 生成不与现有冲突的 8 位 uid */
  private async genUniqueUid(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const uid = this.randomUid();
      const exists = await this.users.findOne({ where: { uid } });
      if (!exists) return uid;
    }
    throw new Error('uid 生成碰撞重试失败');
  }

  private randomUid(): string {
    const buf = crypto.randomBytes(8);
    let uid = '';
    // 注意:用 UID_CHARS.length 取模,否则 1/32 概率越界得到 undefined
    for (let i = 0; i < 8; i++) uid += UID_CHARS[buf[i] % UID_CHARS.length];
    return uid;
  }

  /** 校验 uid 格式: 8 位且字符集合法(=UID_CHARS) */
  private validateUidFormat(uid: string): void {
    if (typeof uid !== 'string' || uid.length !== 8) {
      throw new BadRequestException('uid 必须为 8 位字符');
    }
    for (const ch of uid) {
      if (!UID_CHARS.includes(ch)) {
        throw new BadRequestException(`uid 含非法字符 ${ch}(仅可用 ${UID_CHARS.length} 字符集)`);
      }
    }
  }
}

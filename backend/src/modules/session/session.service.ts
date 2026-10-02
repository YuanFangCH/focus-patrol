import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FocusSession } from '../../entities/focus-session.entity';
import { PatrolRecord } from '../../entities/patrol-record.entity';
import { HonorService } from '../honor/honor.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(FocusSession) private readonly sessions: Repository<FocusSession>,
    @InjectRepository(PatrolRecord) private readonly patrols: Repository<PatrolRecord>,
    private readonly honor: HonorService,
  ) {}

  /** 创建番茄钟会话(支持 type: focus 专注 / break 休息) */
  async create(userId: string, durationMinutes: number, mode: 'off' | 'camera' | 'screen', type?: 'focus' | 'break') {
    if (durationMinutes < 1 || durationMinutes > 180) {
      throw new BadRequestException('时长需在 1-180 分钟之间');
    }
    const session = await this.sessions.save(
      this.sessions.create({
        userId,
        status: 'running',
        durationMinutes,
        mode,
        type: type ?? 'focus',
      }),
    );
    return { session };
  }

  /** 结束会话,计算 score/exp */
  async end(userId: string, sessionId: string, actualSeconds: number) {
    const session = await this.sessions.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('会话不存在');
    if (session.status !== 'running') throw new BadRequestException('会话已结束');

    // 休息段: 只记录, 不结算荣誉/经验/得分
    if (session.type === 'break') {
      session.status = 'completed';
      session.actualSeconds = actualSeconds;
      session.endedAt = new Date();
      await this.sessions.save(session);
      return {
        session,
        score: 0,
        expGained: 0,
        levelUp: null,
        unlockedAchievements: [],
      };
    }

    const targetSeconds = session.durationMinutes * 60;
    const ratio = Math.min(actualSeconds / targetSeconds, 1.5);
    const score = Math.max(0, Math.round(100 * Math.min(ratio, 1)));

    session.status = 'completed';
    session.actualSeconds = actualSeconds;
    session.score = score;
    session.endedAt = new Date();
    await this.sessions.save(session);

    // 经验:基础 10 + 得分加成
    const expGained = 10 + Math.round(score / 10);

    // 荣誉结算:加分升段 + 成就解锁(零违纪计数来自本次会话的巡查记录)
    const noViolationPatrols = await this.patrols.count({
      where: { sessionId: session.id, isViolation: false },
    });
    const settle = await this.honor.addExpAndSettle(userId, expGained, {
      completedSessions: await this.sessions.count({ where: { userId, status: 'completed' } }),
      patrolsNoViolation: noViolationPatrols,
    });

    return {
      session,
      score,
      expGained,
      levelUp: settle.levelUp,
      unlockedAchievements: settle.unlockedAchievements,
    };
  }

  /** 中断会话 */
  async interrupt(userId: string, sessionId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('会话不存在');
    if (session.status !== 'running') throw new BadRequestException('会话已结束');
    session.status = 'interrupted';
    session.endedAt = new Date();
    await this.sessions.save(session);
    return {};
  }

  /** 历史列表 */
  async list(userId: string, status?: string, page = 1, size = 20) {
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    const [list, total] = await this.sessions.findAndCount({
      where,
      order: { startedAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { list, total };
  }

  /** 详情(含巡查记录) */
  async detail(userId: string, sessionId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('会话不存在');
    const patrols = await this.patrols.find({
      where: { sessionId },
      order: { scheduledAt: 'DESC' },
    });
    return { session, patrols };
  }
}

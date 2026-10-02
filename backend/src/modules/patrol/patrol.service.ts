import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PatrolRecord } from '../../entities/patrol-record.entity';
import { ViolationSnapshot } from '../../entities/violation-snapshot.entity';
import { FocusSession } from '../../entities/focus-session.entity';
import { SpotCheck } from '../../entities/spot-check.entity';
import { AIVisionRouter } from '../../vision/ai-vision.router';
import { TrackService } from '../track/track.service';

@Injectable()
export class PatrolService {
  private readonly logger = new Logger('PatrolService');
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(PatrolRecord) private readonly patrols: Repository<PatrolRecord>,
    @InjectRepository(ViolationSnapshot) private readonly snapshots: Repository<ViolationSnapshot>,
    @InjectRepository(FocusSession) private readonly sessions: Repository<FocusSession>,
    @InjectRepository(SpotCheck) private readonly spotChecks: Repository<SpotCheck>,
    private readonly vision: AIVisionRouter,
    private readonly track: TrackService,
    cfg: ConfigService,
  ) {
    this.uploadDir = cfg.get('UPLOAD_DIR') || './uploads';
    fs.mkdirSync(path.join(this.uploadDir, 'violations'), { recursive: true });
    fs.mkdirSync(path.join(this.uploadDir, 'spot'), { recursive: true });
  }

  /**
   * 巡查判定入口:
   * 1. 校验会话归属
   * 2. AI 判定
   * 3. 违纪帧留存快照,否则不留
   * 4. 更新会话的 patrol_count / violation_count
   */
  async evaluate(
    userId: string,
    image: Buffer,
    sessionId: string,
    source: 'camera' | 'screen',
  ) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('会话不存在');
    }

    const result = await this.vision.evaluate(image, {
      sessionId,
      source,
      ts: Date.now(),
    });

    const isViolation = result.result === 'distracted' || result.result === 'away';
    const record = await this.patrols.save(
      this.patrols.create({
        sessionId,
        userId,
        source,
        result: result.result,
        confidence: result.confidence,
        model: result.model,
        isViolation,
        scheduledAt: new Date(),
        judgedAt: new Date(),
      }),
    );

    let snapshotUrl: string | null = null;
    if (isViolation) {
      const objectKey = `violations/${userId}/${record.id}.jpg`;
      const filePath = path.join(this.uploadDir, objectKey);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, image);
      await this.snapshots.save(
        this.snapshots.create({
          patrolRecordId: record.id,
          userId,
          objectKey,
          width: 0,
          height: 0,
          sizeBytes: image.length,
        }),
      );
      snapshotUrl = `/uploads/${objectKey}`;
      record.snapshotUrl = snapshotUrl;
      await this.patrols.save(record);
      this.logger.warn(`违纪快照留存: ${objectKey} (${image.length} bytes)`);
    }

    // 更新会话统计
    await this.sessions.increment({ id: sessionId }, 'patrolCount', 1);
    if (isViolation) {
      await this.sessions.increment({ id: sessionId }, 'violationCount', 1);
    }

    // 重查最新计数, 随判定结果返回给前端实时刷新统计
    const updated = await this.sessions.findOne({ where: { id: sessionId } });
    return {
      patrolId: record.id,
      result: record.result,
      confidence: record.confidence,
      isViolation: record.isViolation,
      snapshotUrl,
      patrolCount: updated?.patrolCount ?? 0,
      violationCount: updated?.violationCount ?? 0,
    };
  }

  /**
   * 本地规则判定落库(前端规则分流: 遮挡类 camera 直接判 away)
   * image 可选: 违纪帧随传则留存违纪快照(留档自动上传后端, 供质量核查)
   * 规则判定结果确定性高(遮挡镜头), 但仍需校验会话归属防伪造
   */
  async localRule(
    userId: string,
    sessionId: string,
    source: 'camera' | 'screen',
    rule: string,
    result: 'away',
    image?: Buffer,
  ) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('会话不存在');
    }

    const record = await this.patrols.save(
      this.patrols.create({
        sessionId,
        userId,
        source,
        result,
        confidence: 0.7,
        model: 'local-rule',
        isViolation: true,
        scheduledAt: new Date(),
        judgedAt: new Date(),
      }),
    );

    // 违纪帧留档: 带图则自动上传后端并留存快照(与 AI 判定违纪行为一致)
    let snapshotUrl: string | null = null;
    if (image && image.length > 0) {
      const objectKey = `violations/${userId}/${record.id}.jpg`;
      const filePath = path.join(this.uploadDir, objectKey);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, image);
      await this.snapshots.save(
        this.snapshots.create({
          patrolRecordId: record.id,
          userId,
          objectKey,
          width: 0,
          height: 0,
          sizeBytes: image.length,
        }),
      );
      snapshotUrl = `/uploads/${objectKey}`;
      record.snapshotUrl = snapshotUrl;
      await this.patrols.save(record);
      this.logger.warn(`本地规则违纪帧留档: ${objectKey} (${image.length} bytes)`);
    }

    // 更新会话统计
    await this.sessions.increment({ id: sessionId }, 'patrolCount', 1);
    await this.sessions.increment({ id: sessionId }, 'violationCount', 1);

    // 重查最新计数, 随判定结果返回给前端实时刷新统计
    const updated = await this.sessions.findOne({ where: { id: sessionId } });
    this.logger.warn(`本地规则判定: rule=${rule} result=${result} session=${sessionId}`);
    return {
      patrolId: record.id,
      result: record.result,
      confidence: record.confidence,
      isViolation: record.isViolation,
      snapshotUrl,
      patrolCount: updated?.patrolCount ?? 0,
      violationCount: updated?.violationCount ?? 0,
    };
  }

  /** 查看违纪快照图片流 */
  async getSnapshot(userId: string, patrolId: string) {
    const patrol = await this.patrols.findOne({ where: { id: patrolId } });
    if (!patrol || patrol.userId !== userId) {
      throw new NotFoundException('巡查记录不存在');
    }
    if (!patrol.snapshotUrl) {
      throw new NotFoundException('该巡查无快照(非违纪帧不留存)');
    }
    const filePath = path.join(this.uploadDir, patrol.snapshotUrl.replace('/uploads/', ''));
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('快照文件不存在');
    }
    return fs.readFileSync(filePath);
  }

  /** 删除快照(违纪帧可自行删除) */
  async deleteSnapshot(userId: string, patrolId: string) {
    const patrol = await this.patrols.findOne({ where: { id: patrolId } });
    if (!patrol || patrol.userId !== userId) {
      throw new NotFoundException('巡查记录不存在');
    }
    if (!patrol.snapshotUrl) return {};
    const filePath = path.join(this.uploadDir, patrol.snapshotUrl.replace('/uploads/', ''));
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      // 文件可能已被外部删除或删除失败:不阻塞业务,记录日志即可
      this.logger.warn(`删除快照文件失败: ${filePath} ${(e as Error).message}`);
    }
    // 显式 UPDATE 置 NULL(不能用实体赋值 undefined,TypeORM save 会忽略)
    await this.patrols.update({ id: patrolId }, { snapshotUrl: null as unknown as undefined });
    return {};
  }

  /** 会话的巡查记录 */
  async listBySession(userId: string, sessionId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new NotFoundException('会话不存在');
    return this.patrols.find({
      where: { sessionId },
      order: { scheduledAt: 'DESC' },
      take: 50,
    });
  }

  /** 定时清理 30 天前的违纪快照(由 ScheduleModule 调用) */
  async cleanupExpiredSnapshots() {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const expired = await this.snapshots.find({ where: { createdAt: MoreThan(cutoff) } });
    // 逻辑相反:只保留 30 天内的,删除更早的
    const all = await this.snapshots.find();
    const toDelete = all.filter((s) => s.createdAt < cutoff);
    for (const s of toDelete) {
      const filePath = path.join(this.uploadDir, s.objectKey);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        this.logger.warn(`清理快照文件失败: ${filePath} ${(e as Error).message}`);
      }
      await this.snapshots.delete(s.id);
    }
    this.logger.log(`清理过期快照 ${toDelete.length} 条`);
    return { deleted: toDelete.length };
  }

  // ---------- 突击检查 ----------

  /** 管理员发起突击检查: 落一个 pending 任务, 用户端轮询认领(在线离线均可发起) */
  async createSpotCheck(targetUserId: string) {
    const [onlineSet, live] = await Promise.all([
      this.track.onlineStatus([targetUserId]),
      this.sessions.findOne({
        where: { userId: targetUserId, status: 'running' },
        order: { startedAt: 'DESC' },
      }),
    ]);
    const online = onlineSet.online.includes(targetUserId);
    // canCapture: 尽力判断(在线且有 running 会话≈可能开了巡查/预览; 浏览器安全不可强行跨源取流)
    const canCapture = online && !!live;
    const hint = !online
      ? '该用户当前不在线,任务将在其上线后自动认领'
      : canCapture
        ? '用户在线且当前有会话,可进行突击检查'
        : '用户在线,但当前无巡查会话,可能需其开启摄像头才能完成抓帧';

    const spot = await this.spotChecks.save(
      this.spotChecks.create({
        userId: targetUserId,
        status: 'pending',
        sessionId: live?.id ?? null,
      }),
    );
    this.logger.log(`突击检查已发起: user=${targetUserId} spot=${spot.id} online=${online}`);
    return { taskId: spot.id, online, canCapture, hint };
  }

  /** 用户端查询是否有待处理的突击检查 */
  async getUserSpotTask(userId: string) {
    const pending = await this.spotChecks.findOne({
      where: { userId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    if (!pending) return { shouldCheck: false };
    return { shouldCheck: true, taskId: pending.id };
  }

  /**
   * 用户端提交突击检查抓帧: AI 判定 + 存压缩图(独立于 focus session)
   */
  async submitSpotCheck(userId: string, image: Buffer, taskId: string, source: 'camera' | 'screen') {
    const spot = await this.spotChecks.findOne({ where: { id: taskId } });
    if (!spot || spot.userId !== userId) {
      throw new NotFoundException('突击检查任务不存在');
    }
    if (spot.status !== 'pending') {
      throw new NotFoundException('突击检查任务已处理');
    }

    // AI 判定(不依赖 focus session)
    const result = await this.vision.evaluate(image, {
      sessionId: '',
      source,
      ts: Date.now(),
    });
    const isViolation = result.result === 'distracted' || result.result === 'away';

    // 存压缩图 uploads/spot/{userId}/{spot.id}.jpg
    const objectKey = `spot/${userId}/${spot.id}.jpg`;
    const filePath = path.join(this.uploadDir, objectKey);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, image);

    await this.spotChecks.update({ id: spot.id }, {
      status: 'done',
      result: result.result,
      confidence: result.confidence,
      objectKey,
      source,
    });

    this.logger.warn(`突击检查完成: user=${userId} spot=${spot.id} → ${result.result}`);
    return {
      taskId: spot.id,
      result: result.result,
      confidence: result.confidence,
      isViolation,
    };
  }

  // admin 侧: 突击检查历史 / 图查看 / 图删除

  /** 某用户突击检查历史 */
  async listUserSpotChecks(userId: string) {
    const list = await this.spotChecks.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return list.map((s) => ({
      id: s.id,
      status: s.status,
      result: s.result ?? null,
      confidence: s.confidence ?? null,
      source: s.source ?? null,
      createdAt: s.createdAt,
      hasImage: !!s.objectKey,
    }));
  }

  /** 取突击检查原图(管理员查看, 校验归属) */
  async getSpotImage(userId: string, taskId: string): Promise<Buffer> {
    const spot = await this.spotChecks.findOne({ where: { id: taskId } });
    if (!spot || spot.userId !== userId) throw new NotFoundException('突击检查任务不存在');
    if (!spot.objectKey) throw new NotFoundException('该任务无图像');
    const filePath = path.join(this.uploadDir, spot.objectKey);
    if (!fs.existsSync(filePath)) throw new NotFoundException('图像文件不存在');
    return fs.readFileSync(filePath);
  }

  /** 删除突击检查图(只删图, 保留判定期记录) */
  async deleteSpotImage(userId: string, taskId: string) {
    const spot = await this.spotChecks.findOne({ where: { id: taskId } });
    if (!spot || spot.userId !== userId) throw new NotFoundException('突击检查任务不存在');
    if (spot.objectKey) {
      const filePath = path.join(this.uploadDir, spot.objectKey);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        this.logger.warn(`删除突击检查图失败: ${filePath} ${(e as Error).message}`);
      }
    }
    await this.spotChecks.update({ id: spot.id }, { objectKey: null as unknown as undefined });
    return { ok: true };
  }
}

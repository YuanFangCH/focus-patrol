'use client';

/**
 * 巡查引擎: 采集画面 → 指纹预筛 → 本地规则判定 → 显著变化才上传单帧 → AI 判定
 *
 * 架构:
 * - camera 模式: getUserMedia 摄像头流
 * - screen 模式: getDisplayMedia 屏幕共享流
 * - 本地指纹(32x32 感知哈希)做预筛: 帧间差异 < threshold 视为画面未变, 跳过上传
 * - 本地规则判定(无需 AI, 省调用): 黑/纯色等遮挡类在 camera 源连续 2 次 → 直接判 away;
 *   screen 源黑/纯色/静止 → 仅跳过不误判(黑屏可能是视频, 静止是阅读)
 * - 内置节流: 最短上传间隔 minIntervalMs, 防止连拍风暴
 * - 判定为违纪(distracted/away)时触发 onViolation 回调
 */

import {
  computeFingerprint, fingerprintDiff, frameToJpeg, frameStats, classifyFrame,
} from './fingerprint';
import { patrolApi, type PatrolVerdict } from '@/lib/api/patrols';
import { requestCameraStream } from './cameraAccess';

export type PatrolSource = 'camera' | 'screen';

/** 本地规则判定结果 */
export interface LocalRuleResult {
  rule: string;
  result: 'away';
}

/**
 * 巡查频率映射(配置页选择 → 引擎参数)
 * intervalMs=采样间隔 / minUploadGapMs=上传节流(必须 >= intervalMs)
 * / changeThreshold=画面变化阈值 / localRuleHits=本地规则连续命中次数
 */
export interface PatrolFrequencyParams {
  intervalMs: number;
  minUploadGapMs: number;
  changeThreshold: number;
  localRuleHits: number;
}

export const PATROL_FREQUENCY_MAP: Record<'slow' | 'normal' | 'nightmare', PatrolFrequencyParams> = {
  slow: { intervalMs: 60000, minUploadGapMs: 120000, changeThreshold: 0.12, localRuleHits: 2 },
  normal: { intervalMs: 30000, minUploadGapMs: 60000, changeThreshold: 0.08, localRuleHits: 2 },
  nightmare: { intervalMs: 10000, minUploadGapMs: 15000, changeThreshold: 0.06, localRuleHits: 1 },
};

/** 起步期(热身)时长: 会话开始前 5 分钟 */
export const WARMUP_MS = 5 * 60 * 1000;
/** 起步期内强制巡查间隔: 每 1 分钟必须上传/判定一次(无视画面是否静止) */
export const WARMUP_INTERVAL_MS = 60 * 1000;

export interface PatrolEngineOptions {
  sessionId: string;
  source: PatrolSource;
  /** 采样间隔 ms (默认 10000 = 每 10s 采一帧) */
  intervalMs?: number;
  /** 最短上传间隔 ms (默认 20000 = 20s 内最多 1 次判定) */
  minUploadGapMs?: number;
  /** 画面变化阈值: 帧间指纹差异超过它才上传 (默认 0.08) */
  changeThreshold?: number;
  /** 本地规则连续命中次数后才判定 (默认 2, 即 ≥20s 缓冲防误判) */
  localRuleHits?: number;
  /** 指定摄像头 deviceId(空=自动) */
  deviceId?: string;
  /** 视频容器(摄像头常开时传入, video 显示到此; 否则隐藏取帧) */
  container?: HTMLElement | null;
  /** 外部传入的媒体流(摄像头常开预览流复用; 传入则跳过自采流) */
  stream?: MediaStream;
  /**
   * 判定完成回调; frame 为判定所用的静态画面(JPEG Blob), 供前端留档/质量核查
   * frame 仅存当前页面内存, 页面退出即释放
   */
  onVerdict?: (verdict: PatrolVerdict, frame?: Blob) => void;
  /** 违纪判定回调; frame 为违纪帧, 随回调传出供留档/自动上传后端 */
  onViolation?: (verdict: PatrolVerdict, frame?: Blob) => void;
  onError?: (err: Error) => void;
}

export class PatrolEngine {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastHash: Uint8Array | null = null;
  private lastUploadAt = 0;
  private running = false;
  private active = true;
  /** 本地规则连续命中计数(camera 遮挡类) */
  private localHitCount = 0;
  /** 连续高频闪烁计数(>0.5) */
  private flickerCount = 0;
  /** 是否为外部传入流(预览复用, 不归本引擎停止) */
  private externalStream = false;
  /** 引擎启动时刻(用于起步期热身巡查) */
  private startedAt = 0;

  constructor(private readonly opts: PatrolEngineOptions) {}

  async start(): Promise<void> {
    if (this.running) return;
    // 采集流: 有外部传入流(预览复用)则直接用, 否则自己获取
    let stream: MediaStream;
    if (this.opts.stream) {
      this.externalStream = true;
      stream = this.opts.stream;
    } else {
      stream = await this.acquireStream();
    }
    this.stream = stream;

    // video 元素: 摄像头常开时显示到 container, 否则隐藏仅取帧
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    if (this.opts.container) {
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      this.opts.container.innerHTML = '';
      this.opts.container.appendChild(video);
    } else {
      video.style.display = 'none';
      document.body.appendChild(video);
    }
    this.video = video;

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        video.removeEventListener('loadeddata', onReady);
        resolve();
      };
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('error', () => reject(new Error('视频流加载失败')));
      void video.play().catch(() => reject(new Error('无法播放视频流')));
      setTimeout(onReady, 3000); // 兜底
    });

    this.running = true;
    this.startedAt = Date.now(); // 起步期计时起点
    const intervalMs = this.opts.intervalMs ?? 10000;
    this.timer = setInterval(() => void this.tick(), intervalMs);
    // 立即采一帧
    void this.tick();
  }

  stop(): void {
    this.active = false;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // 外部传入流(预览复用)不归本引擎停止, 由 CameraPreview 管理
    if (this.stream && !this.externalStream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }
    this.lastHash = null;
    this.localHitCount = 0;
    this.flickerCount = 0;
    this.externalStream = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** 内嵌 video 元素(摄像头常开预览用) */
  get videoElement(): HTMLVideoElement | null {
    return this.video;
  }

  private async acquireStream(): Promise<MediaStream> {
    if (this.opts.source === 'camera') {
      // 统一走 cameraAccess: 含 HTTPS 检查与友好错误(iOS 兼容)
      return requestCameraStream({
        deviceId: this.opts.deviceId,
        width: 640,
        height: 480,
      });
    }
    // screen 模式: 屏幕共享(需 https 或 localhost)
    return navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 5, max: 10 } },
      audio: false,
    });
  }

  private async tick(): Promise<void> {
    if (!this.active || !this.video) return;
    const frame = computeFingerprint(this.video);
    if (!frame) return;

    const now = Date.now();
    const minGap = this.opts.minUploadGapMs ?? 20000;
    const hitsNeeded = this.opts.localRuleHits ?? 2;

    // 起步期(会话开始前 5 分钟): 每 1 分钟强制巡查一次(无视画面是否静止)
    const elapsed = now - this.startedAt;
    const inWarmup = elapsed >= 0 && elapsed < WARMUP_MS;
    // 起步期有效节流: 取难度档位与起步 60s 的更短者(慢档 120s→起步 60s)
    const effectiveGap = inWarmup ? Math.min(minGap, WARMUP_INTERVAL_MS) : minGap;

    // 1. 本地规则判定: 黑/白/纯色(遮挡类)
    const stats = frameStats(frame.gray);
    const cls = classifyFrame(stats);
    const occluding = cls === 'black' || cls === 'white' || cls === 'solid';

    if (occluding) {
      this.localHitCount += 1;
      // 连续命中足够次数(≥20s 缓冲)
      if (this.localHitCount >= hitsNeeded) {
        if (this.opts.source === 'camera') {
          // camera 遮挡确定性高 → 本地直接判 away, 不上传 AI
          if (now - this.lastUploadAt >= effectiveGap) {
            this.lastUploadAt = now;
            this.localHitCount = 0; // 判定后重置, 防每 10s 重复上报
            await this.reportLocalRule(`occluded-${cls}`, 'away');
          }
        }
        // screen 源遮挡类(黑屏/纯色) → 仅跳过, 不判违纪(可能是视频/阅读, 防误判)
      }
      this.lastHash = frame.hash;
      return; // 遮挡类不再走上传
    }
    this.localHitCount = 0;

    // 2. 指纹预筛: 非起步期画面变化超过阈值才继续; 起步期画面静止也在起步间隔后强制巡查
    if (this.lastHash) {
      const diff = fingerprintDiff(this.lastHash, frame.hash);
      // 高频闪烁: 连续 2 次 diff>0.5 → 模棱两可交 AI 兜底(不跳过)
      if (diff > 0.5) {
        this.flickerCount += 1;
      } else {
        this.flickerCount = 0;
      }
      const belowChange = diff < (this.opts.changeThreshold ?? 0.08);
      // 起步期: 画面未变但距上次判定已达起步间隔 → 也强制巡查(不留死角)
      const warmupForced = inWarmup && now - this.lastUploadAt >= effectiveGap;
      if (belowChange && !warmupForced) {
        this.lastHash = frame.hash;
        return;
      }
    }
    this.lastHash = frame.hash;

    // 3. 节流: 最短上传间隔(起步期用有效节流, 非起步期用难度档位)
    if (now - this.lastUploadAt < effectiveGap) return;
    this.lastUploadAt = now;

    try {
      const blob = await frameToJpeg(this.video);
      if (!blob) return;
      const verdict = await patrolApi.evaluate(this.opts.sessionId, this.opts.source, blob);
      this.opts.onVerdict?.(verdict, blob);
      if (verdict.isViolation) this.opts.onViolation?.(verdict, blob);
    } catch (e) {
      this.opts.onError?.(e as Error);
    }
  }

  /**
   * 上报本地规则判定结果(落库)
   * 违纪帧随传: 自动上传后端留存快照(留档自动上传), 同时作为留档帧回传
   */
  private async reportLocalRule(rule: string, result: 'away'): Promise<void> {
    try {
      const blob = this.video ? await frameToJpeg(this.video) : null;
      const verdict = await patrolApi.reportLocalRule(
        this.opts.sessionId,
        this.opts.source,
        rule,
        result,
        blob ?? undefined,
      );
      this.opts.onVerdict?.(verdict, blob ?? undefined);
      this.opts.onViolation?.(verdict, blob ?? undefined);
    } catch (e) {
      this.opts.onError?.(e as Error);
    }
  }
}

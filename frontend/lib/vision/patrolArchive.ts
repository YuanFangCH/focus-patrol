import type { PatrolResult } from '@/lib/api/patrols';

/**
 * 巡查判定留档条目
 *
 * 留档规则:
 * - 每次判定(含本地规则/AI 判定)抽样留存一份"静态画面 + 判定结果", 供当前页面质量核查
 * - 仅保留在当前页面内存(blob URL), 退出页面/会话即自动删除
 * - 违纪判定自动上传后端留存快照(uploaded=true, snapshotUrl 为后端留档地址)
 */
export interface PatrolArchiveEntry {
  /** 唯一 id(优先用后端 patrolId, 兜底本地生成) */
  id: string;
  /** 判定时间戳(ms) */
  ts: number;
  source: 'camera' | 'screen';
  result: PatrolResult;
  confidence: number;
  isViolation: boolean;
  /** 是否已上传后端留档(违纪判定自动上传, snapshotUrl 非空即视为已上传) */
  uploaded: boolean;
  /** 后端违纪快照地址(违纪自动上传后端留档; 非违纪为 null) */
  snapshotUrl: string | null;
  /** 本地留档画面 blob URL(仅本次页面内存, 退出即释放) */
  frameUrl: string | null;
}

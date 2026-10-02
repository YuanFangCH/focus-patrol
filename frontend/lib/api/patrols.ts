import { api } from './client';

export type PatrolResult = 'focus' | 'distracted' | 'away';

export interface PatrolVerdict {
  patrolId: string;
  result: PatrolResult;
  confidence: number;
  isViolation: boolean;
  snapshotUrl: string | null;
  /** 判定后会话最新巡查次数(后端实时计数, 用于前端统计展示) */
  patrolCount: number;
  /** 判定后会话最新违纪次数 */
  violationCount: number;
}

export interface PatrolRecord {
  id: string;
  sessionId: string;
  source: 'camera' | 'screen';
  result: PatrolResult;
  confidence: number;
  isViolation: boolean;
  snapshotUrl: string | null;
  scheduledAt: string;
}

export const patrolApi = {
  /** 上传单帧做 AI 判定 */
  evaluate: (sessionId: string, source: 'camera' | 'screen', image: Blob) => {
    const form = new FormData();
    form.append('image', image, `frame-${Date.now()}.jpg`);
    return api.multipart<PatrolVerdict>(
      `/patrols/evaluate?sessionId=${sessionId}&source=${source}`,
      form,
    );
  },

  /** 上报本地规则判定(前端规则分流: 遮挡类 camera 直接判 away) */
  reportLocalRule: (
    sessionId: string,
    source: 'camera' | 'screen',
    rule: string,
    result: 'away',
    image?: Blob,
  ) => {
    const qs = `sessionId=${sessionId}&source=${source}&rule=${encodeURIComponent(rule)}&result=${result}`;
    // 违纪帧随传: 自动上传后端留档(供质量核查), 走 multipart
    if (image) {
      const form = new FormData();
      form.append('image', image, `local-${Date.now()}.jpg`);
      return api.multipart<PatrolVerdict>(`/patrols/local-rule?${qs}`, form);
    }
    return api.post<PatrolVerdict>(`/patrols/local-rule?${qs}`);
  },

  /** 某会话的巡查记录 */
  listBySession: (sessionId: string) =>
    api.get<PatrolRecord[]>(`/patrols?sessionId=${sessionId}`),

  /** 查看违纪快照(图片流) */
  snapshotUrl: (patrolId: string) => `/patrols/${patrolId}/snapshot`,

  /** 删除违纪快照 */
  deleteSnapshot: (patrolId: string) =>
    api.delete<Record<string, never>>(`/patrols/${patrolId}/snapshot`),

  // ---------- 突击检查(用户端) ----------

  /** 查询是否有待处理的突击检查 */
  checkTask: () => api.get<{ shouldCheck: boolean; taskId?: string }>('/patrols/check/task'),

  /** 提交突击检查抓帧(供管理员侧判定) */
  submitCheck: (taskId: string, image: Blob) => {
    const form = new FormData();
    form.append('image', image, `spot-${Date.now()}.jpg`);
    return api.multipart<{ taskId: string; result: PatrolResult; confidence: number; isViolation: boolean }>(
      `/patrols/check/submit?taskId=${taskId}&source=camera`,
      form,
    );
  },
};

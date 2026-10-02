/**
 * 管理面板 API 封装
 * 管理接口仅本机/局域网可调(LocalIpGuard),这里直连本机后端且不携带 JWT。
 */

const ADMIN_BASE = 'http://127.0.0.1:3001/api/admin';

export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiResp<T> {
  code: number;
  data: T | null;
  message: string;
}

async function raw<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new AdminApiError(0, `无法连接后端(请确认 3001 已启动): ${(e as Error).message}`);
  }
  let json: ApiResp<T> | null = null;
  try {
    json = (await res.json()) as ApiResp<T>;
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok || !json || json.code !== 0) {
    throw new AdminApiError(res.status, json?.message || `请求失败(${res.status})`);
  }
  return json.data as T;
}

/** 取二进制(突击检查原图预览) */
async function rawBlob(path: string): Promise<Blob> {
  const res = await fetch(`${ADMIN_BASE}${path}`);
  if (!res.ok) {
    let msg = `请求失败(${res.status})`;
    try {
      const j = (await res.json()) as ApiResp<unknown>;
      if (j?.message) msg = j.message;
    } catch { /* 非 JSON */ }
    throw new AdminApiError(res.status, msg);
  }
  return res.blob();
}

// ---------- 类型 ----------

export interface AdminUser {
  id: string;
  uid: string | null;
  nickname: string;
  status: number;
  role: string;
  isGuest: boolean;
  honorLevelId: number | null;
  honorLevelName: string | null;
  honorExp: number;
  createdAt: string;
  online?: boolean;
}

export interface AdminUserDetail extends AdminUser {
  lastActiveAt: string | null;
}

export interface AdminStats {
  users: number;
  sessions: number;
  violations: number;
  snapshots: number;
}

export interface AdminUserDetailResp {
  user: AdminUserDetail;
  counts: {
    sessions: number;
    completed: number;
    patrols: number;
    violations: number;
    snapshots: number;
    friends: number;
    notifications: number;
    unread: number;
    achievements: number;
  };
  recentSessions: Array<Record<string, unknown>>;
  recentViolations: Array<Record<string, unknown>>;
  achievements: Array<{ code: string; name: string; description?: string }>;
}

export interface AdminCreatedAccount {
  id: string;
  uid: string;
  nickname: string;
}

// ---------- API ----------

export const adminApi = {
  stats: () => raw<AdminStats>('/stats'),

  listUsers: (params: { page?: number; size?: number; keyword?: string; status?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.size) qs.set('size', String(params.size));
    if (params.keyword) qs.set('keyword', params.keyword);
    if (params.status !== undefined) qs.set('status', String(params.status));
    return raw<{ list: AdminUser[]; total: number; page: number; size: number }>(`/users?${qs.toString()}`);
  },

  userDetail: (id: string) => raw<AdminUserDetailResp>(`/users/${id}`),

  /** 实时获取用户状态(在线/当前状态/已开始时长/违规) */
  userRealtime: (id: string) => raw<RealtimeStatus>(`/users/${id}/realtime`),

  createUsers: (nickname: string, count: number) =>
    raw<{ count: number; accounts: AdminCreatedAccount[] }>('/users', {
      method: 'POST',
      body: JSON.stringify({ nickname, count }),
    }),

  updateUser: (id: string, patch: { nickname?: string; status?: number }) =>
    raw<{ ok: boolean }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  batchUpdateUsers: (ids: string[], patch: { nickname?: string; status?: number }) =>
    raw<{ ok: boolean; updated: number }>('/users/batch', {
      method: 'PATCH',
      body: JSON.stringify({ ids, ...patch }),
    }),

  setUserUid: (id: string, uid: string) =>
    raw<{ ok: boolean; uid: string }>(`/users/${id}/uid`, {
      method: 'PUT',
      body: JSON.stringify({ uid }),
    }),

  deleteUser: (id: string) =>
    raw<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),

  // ---------- 突击检查 ----------

  /** 发起突击检查(返回 taskId + 在线/可抓帧提示) */
  spotCheck: (userId: string) =>
    raw<SpotCheckLaunch>(`/patrol/spot/${userId}`, { method: 'POST' }),

  /** 突击检查历史 */
  spotHistory: (userId: string) =>
    raw<SpotCheckItem[]>(`/patrol/spot/${userId}`),

  /** 取突击检查原图(返回 blob url) */
  spotImage: async (userId: string, taskId: string) => {
    const blob = await rawBlob(`/patrol/spot/${userId}/image?taskId=${taskId}`);
    return URL.createObjectURL(blob);
  },

  /** 删除突击检查图 */
  spotDeleteImage: (userId: string, taskId: string) =>
    raw<{ ok: boolean }>(`/patrol/spot/${userId}/image?taskId=${taskId}`, { method: 'DELETE' }),

  // ---------- AI 配置 ----------

  listAiConfig: () => raw<AiConfigEntry[]>('/ai-config'),

  /** 视觉模型用量统计(每厂商今日+近N天) */
  listAiUsage: (days = 7) => raw<AiUsageStats[]>(`/ai-config/usage?days=${days}`),

  updateAiConfig: (provider: string, patch: { apiKey?: string; modelName?: string; baseUrl?: string; enabled?: boolean; dailyQuota?: number }) =>
    raw<{ ok: boolean }>(`/ai-config/${provider}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
};

export interface AiConfigEntry {
  provider: string;
  modelName: string;
  keyMasked: string | null;
  hasKey: boolean;
  enabled: boolean;
  dailyQuota: number;
  baseUrl: string | null;
}

export interface AiUsageStats {
  provider: string;
  model: string;
  today: { calls: number; tokens: number };
  week: { calls: number; tokens: number };
}

export interface SpotCheckItem {
  id: string;
  status: 'pending' | 'done';
  result: string | null;
  confidence: number | null;
  source: string | null;
  createdAt: string;
  hasImage: boolean;
}

/** 突击检查发起返回 */
export interface SpotCheckLaunch {
  taskId: string;
  online: boolean;
  canCapture: boolean;
  hint: string;
}

/** 实时用户状态 */
export interface RealtimeStatus {
  online: boolean;
  currentStatus: 'offline' | 'online-idle' | 'online-focus' | 'online-break';
  elapsedSeconds: number;
  runningSession: {
    id: string;
    mode: string;
    type: string;
    status: string;
    durationMinutes: number;
    actualSeconds: number;
    hardLimitMinutes: number;
    patrolCount: number;
    violationCount: number;
    startedAt: string;
  } | null;
  recentViolations: Array<{
    id: string;
    result: string;
    confidence?: number | null;
    scheduledAt: string;
  }>;
  lastActiveAt: string | null;
}

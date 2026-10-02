// 类型定义(与后端统一响应对齐)
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface User {
  id: string;
  uid: string | null;
  nickname: string;
  avatarUrl?: string | null;
  honorLevelId: number | null;
  honorExp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface FocusSession {
  id: string;
  status: 'running' | 'completed' | 'interrupted';
  type: 'focus' | 'break';
  mode: 'off' | 'camera' | 'screen';
  durationMinutes: number;
  actualSeconds: number;
  patrolCount: number;
  violationCount: number;
  score?: number | null;
  startedAt: string;
  endedAt?: string | null;
}

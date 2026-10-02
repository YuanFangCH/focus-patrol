import { useAuthStore } from '@/lib/store/authStore';
import type { ApiResponse } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
/** "/" 表示同源(本地反代场景),拼路径时用空串;否则保留完整基址 */
const BASE_PREFIX = API_BASE === '/' ? '' : API_BASE;
/** 统一拼 API 路径: /api/xxx */
function apiUrl(path: string) {
  return `${BASE_PREFIX}/api${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  code: number;
  status: number;
  constructor(status: number, code: number, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshing: Promise<string | null> | null = null;

/** 401 时用 refreshToken 静默刷新,并防并发风暴 */
async function refreshAccess(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { refreshToken, setAuth } = useAuthStore.getState();
    if (!refreshToken) return null;
    try {
      const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        useAuthStore.getState().logout();
        return null;
      }
      const json = (await res.json()) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
        user: import('@/lib/types').User;
      }>;
      if (json.code !== 0) {
        useAuthStore.getState().logout();
        return null;
      }
      setAuth({
        accessToken: json.data.accessToken,
        refreshToken: json.data.refreshToken,
        user: json.data.user,
      });
      return json.data.accessToken;
    } catch {
      useAuthStore.getState().logout();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
  retried = false,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (options.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  // 401 → 刷新重试一次
  if (res.status === 401 && !retried && options.auth !== false) {
    const newToken = await refreshAccess();
    if (newToken) return request<T>(path, options, true);
  }

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !json || json.code !== 0) {
    throw new ApiError(res.status, json?.code ?? 1, json?.message || `请求失败(${res.status})`);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { auth }, false),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, {
      method: 'POST',
      auth,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, auth = true) => request<T>(path, { method: 'DELETE', auth }),
  multipart: <T>(path: string, form: FormData, auth = true) =>
    request<T>(path, { method: 'POST', auth, body: form }),
};

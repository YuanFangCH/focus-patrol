import { api } from './client';
import type { TokenPair, User } from '@/lib/types';

export const authApi = {
  login: (uid: string, rememberIp = false) =>
    api.post<TokenPair>('/auth/login', { uid, rememberIp }, false),

  /** 基于 IP 绑定的免登录: 命中绑定则自动登录, 否则 401 */
  ipLogin: () => api.post<TokenPair>('/auth/ip-login', undefined, false),

  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
};

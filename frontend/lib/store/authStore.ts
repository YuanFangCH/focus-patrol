'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, TokenPair } from '@/lib/types';

/** 主动退出标志(sessionStorage): 本次会话内跳过自动登录 */
export const LOGGED_OUT_KEY = 'aidushu_logged_out';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** 记住最近登录过的 uid(persist 到 localStorage, 下次自动登录/预填) */
  rememberedUid: string | null;
  setAuth: (pair: TokenPair) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      rememberedUid: null,
      setAuth: (pair) =>
        set({
          user: pair.user,
          accessToken: pair.accessToken,
          refreshToken: pair.refreshToken,
          // 登录/刷新/自动登录统一入口: 顺带补记 uid
          rememberedUid: pair.user?.uid ?? null,
        }),
      setUser: (user) => set({ user }),
      logout: () => {
        // 写 sessionStorage 标志: 本次会话内守卫将跳过自动登录(不登回)
        try { sessionStorage.setItem(LOGGED_OUT_KEY, '1'); } catch { /* 忽略 */ }
        // 保留 rememberedUid: 用户确认"退出后下次仍自动登录", 仅本次不登回
        set({ user: null, accessToken: null, refreshToken: null });
      },
    }),
    { name: 'aidushu-auth' },
  ),
);

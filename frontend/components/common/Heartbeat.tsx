'use client';

/**
 * 全局在线心跳组件(无 UI)
 * 挂在 RootLayout, 登录用户在站点的所有页面都保持在线心跳(不依赖工作台页面存活)。
 * 每 60s 上报一次(采样率 1次/分钟, 降低带宽)。无 token 时跳过(未登录无需在线)。
 * 不监听 visibilitychange/leave, 避免与页面切换、多组件竞态导致反复离线。
 */

import { useEffect } from 'react';
import { trackApi } from '@/lib/api/social';
import { useAuthStore } from '@/lib/store/authStore';

export default function Heartbeat() {
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = async () => {
      if (!alive) return;
      const hasToken = !!useAuthStore.getState().accessToken;
      if (!hasToken) return; // 未登录不发心跳
      try {
        await trackApi.ping();
      } catch { /* 静默 */ }
    };

    void beat();
    timer = setInterval(() => void beat(), 60_000);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}

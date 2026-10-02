import { api } from './client';
import type { FocusSession } from '@/lib/types';

export const sessionApi = {
  create: (durationMinutes: number, mode: 'off' | 'camera' | 'screen' = 'off', type?: 'focus' | 'break') =>
    api.post<{ session: FocusSession }>('/sessions', { durationMinutes, mode, ...(type ? { type } : {}) }),

  end: (id: string, actualSeconds: number) =>
    api.post<{
      session: FocusSession;
      score: number;
      expGained: number;
      levelUp: { from: number; to: number; name: string } | null;
      unlockedAchievements?: Array<{ code: string; name: string }>;
    }>(`/sessions/${id}/end`, { actualSeconds }),

  interrupt: (id: string) => api.post(`/sessions/${id}/interrupt`, {}),

  list: (params: { status?: string; page?: number; size?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return api.get<{ list: FocusSession[]; total: number }>(`/sessions${qs ? `?${qs}` : ''}`);
  },
};

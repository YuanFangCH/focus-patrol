'use client';

import { create } from 'zustand';
import { sessionApi } from '@/lib/api/sessions';
import type { FocusSession } from '@/lib/types';

export type TimerPhase = 'idle' | 'running' | 'paused' | 'completed' | 'interrupted';
export type PatrolMode = 'off' | 'camera' | 'screen';

/** 会话结束结果(含荣誉结算信息) */
export interface SessionEndResult {
  score: number;
  expGained: number;
  levelUp: { from: number; to: number; name: string } | null;
  unlockedAchievements: Array<{ code: string; name: string }>;
}

interface SessionState {
  phase: TimerPhase;
  session: FocusSession | null;
  remainingSeconds: number;
  totalSeconds: number;
  mode: PatrolMode;
  /** 无限时长模式(持续劳动, 正向计时) */
  unlimited: boolean;
  timerId: number | null;
  error: string | null;
  lastResult: SessionEndResult | null;

  start: (durationMinutes: number, mode: PatrolMode, opts?: { unlimited?: boolean }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  end: () => Promise<void>;
  interrupt: () => Promise<void>;
  reset: () => void;
  tick: () => void;
  /** 巡查判定后刷新会话的实时计数(已巡查/违纪次数) */
  updatePatrolStats: (patrolCount: number, violationCount: number) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  phase: 'idle',
  session: null,
  remainingSeconds: 0,
  totalSeconds: 0,
  mode: 'off',
  unlimited: false,
  timerId: null,
  error: null,
  lastResult: null,

  updatePatrolStats: (patrolCount, violationCount) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, patrolCount, violationCount } });
  },

  tick: () => {
    const { remainingSeconds, phase, unlimited } = get();
    if (phase !== 'running') return;
    if (unlimited) {
      // 无限时长: 正向累加, 永不自动结束
      set({ remainingSeconds: remainingSeconds + 1, totalSeconds: remainingSeconds + 1 });
      return;
    }
    if (remainingSeconds <= 0) return;
    if (remainingSeconds === 1) {
      // 到点自动结束
      void get().end();
      return;
    }
    set({ remainingSeconds: remainingSeconds - 1 });
  },

  start: async (durationMinutes, mode, opts) => {
    const unlimited = opts?.unlimited ?? false;
    // 无限时长后端按上限 180min 创建(前端正向计时); 番茄钟按原时长
    const apiMinutes = unlimited ? 180 : durationMinutes;
    const { session } = await sessionApi.create(apiMinutes, mode);
    const total = unlimited ? 0 : apiMinutes * 60;
    set({
      session, phase: 'running',
      remainingSeconds: total, totalSeconds: total,
      mode, unlimited, error: null,
    });
    const timerId = window.setInterval(() => get().tick(), 1000);
    set({ timerId });
  },

  pause: () => {
    const { timerId, phase } = get();
    if (phase !== 'running') return;
    if (timerId) window.clearInterval(timerId);
    set({ phase: 'paused', timerId: null });
  },

  resume: () => {
    const { phase } = get();
    if (phase !== 'paused') return;
    set({ phase: 'running' });
    const timerId = window.setInterval(() => get().tick(), 1000);
    set({ timerId });
  },

  end: async () => {
    const { session, totalSeconds, remainingSeconds, timerId, unlimited } = get();
    if (!session || !session.id) return;
    if (timerId) window.clearInterval(timerId);
    const actualSeconds = unlimited
      ? remainingSeconds // 无限模式: 已过秒数
      : Math.max(0, totalSeconds - remainingSeconds);
    try {
      const result = await sessionApi.end(session.id, actualSeconds);
      set({
        phase: 'completed',
        session: result.session,
        timerId: null,
        lastResult: {
          score: result.score,
          expGained: result.expGained,
          levelUp: result.levelUp ?? null,
          unlockedAchievements: result.unlockedAchievements ?? [],
        },
      });
    } catch (e) {
      set({ error: (e as Error).message, timerId: null });
    }
  },

  interrupt: async () => {
    const { session, timerId } = get();
    if (!session) return;
    if (timerId) window.clearInterval(timerId);
    try {
      await sessionApi.interrupt(session.id);
    } catch {
      /* 忽略 */
    }
    set({ phase: 'interrupted', timerId: null });
  },

  reset: () => set({
    phase: 'idle', session: null, remainingSeconds: 0, totalSeconds: 0,
    error: null, timerId: null, unlimited: false,
  }),
}));

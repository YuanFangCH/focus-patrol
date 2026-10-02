'use client';

/**
 * 长时间番茄钟调度器(zustand)
 * 由多段学习 + 休息交替组成, 累计学习秒数达总时长后整体结束。
 * 只负责"跨段编排 + 总进度", 每个段的具体 start/end/计时复用 sessionStore。
 *
 * 终止条件(唯一出口): accumulatedStudySeconds >= totalStudySeconds → finish(), 防无限循环。
 */

import { create } from 'zustand';
import { useSessionStore, type PatrolMode } from './sessionStore';
import { sessionApi } from '@/lib/api/sessions';
import { useSettingsStore } from './settingsStore';
import type { FocusSession } from '@/lib/types';

export type SegPhase = 'study' | 'break';

interface LongClockState {
  running: boolean;
  segPhase: SegPhase;
  segIndex: number;                 // 当前学习段序号(1-based)
  accumulatedStudySeconds: number;  // 已累计学习秒数
  totalStudySeconds: number;        // 目标总学习秒数
  segSession: FocusSession | null;  // 当前段 session
  error: string | null;

  start: () => void;
  finish: () => void;
  interrupt: () => void;
  reset: () => void;
  earlyBreak: () => void;      // 学习段提前休息
  startNextStudy: () => void;  // 休息段开始下一段学习
}

/** 模块级非响应式编排状态 */
let unsub: (() => void) | null = null;
let processedSegId: string | null = null;
let transitioning = false;

function readCfg() {
  const s = useSettingsStore.getState();
  return {
    totalSeconds: Math.max(1, s.longTotalMinutes) * 60,
    studySeconds: Math.max(1, s.longStudyMinutes) * 60,
    breakSeconds: Math.max(1, s.longBreakMinutes) * 60,
    patrolMode: s.patrolMode,
  };
}

async function startStudySegment(cfg: ReturnType<typeof readCfg>) {
  await sessionApi.create(cfg.studySeconds / 60, cfg.patrolMode, 'focus');
  await useSessionStore.getState().start(cfg.studySeconds / 60, cfg.patrolMode);
}

async function startBreakSegment(cfg: ReturnType<typeof readCfg>) {
  await sessionApi.create(cfg.breakSeconds / 60, 'off', 'break');
  await useSessionStore.getState().start(cfg.breakSeconds / 60, 'off');
}

export const useLongClockStore = create<LongClockState>((set, get) => {
  /** 学习段结束后的处理 */
  const afterStudyEnd = (session: FocusSession) => {
    if (transitioning || !get().running || processedSegId === session.id) return;
    const cfg = readCfg();
    const newAccum = get().accumulatedStudySeconds + cfg.studySeconds;
    processedSegId = session.id;

    // 唯一终止条件: 累计学习达总时长
    if (newAccum >= cfg.totalSeconds) {
      set({ accumulatedStudySeconds: newAccum });
      get().finish();
      return;
    }
    set({ accumulatedStudySeconds: newAccum, segPhase: 'break' });
    transitioning = true;
    void startBreakSegment(cfg).catch((e) => set({ error: (e as Error).message })).finally(() => { transitioning = false; });
  };

  /** 休息段结束后的处理: 进入下一学习段 */
  const afterBreakEnd = (session: FocusSession) => {
    if (transitioning || !get().running || processedSegId === session.id) return;
    const cfg = readCfg();
    processedSegId = session.id;
    set({ segIndex: get().segIndex + 1, segPhase: 'study' });
    transitioning = true;
    void startStudySegment(cfg).catch((e) => set({ error: (e as Error).message })).finally(() => { transitioning = false; });
  };

  /** sessionStore completed 收敛态触发切段 */
  const onSegCompleted = (session: FocusSession) => {
    const phase = get().segPhase;
    if (phase === 'study') afterStudyEnd(session);
    else afterBreakEnd(session);
  };

  /** 建立订阅 */
  const subscribeSession = () => {
    if (unsub) { unsub(); unsub = null; }
    unsub = useSessionStore.subscribe((state, prev) => {
      if (prev.phase !== 'completed' && state.phase === 'completed' && state.session) {
        onSegCompleted(state.session);
      }
    });
  };

  return {
    running: false,
    segPhase: 'study',
    segIndex: 0,
    accumulatedStudySeconds: 0,
    totalStudySeconds: 0,
    segSession: null,
    error: null,

    start: () => {
      const cfg = readCfg();
      processedSegId = null;
      transitioning = false;
      set({
        running: true, segPhase: 'study', segIndex: 1,
        accumulatedStudySeconds: 0, totalStudySeconds: cfg.totalSeconds,
        segSession: null, error: null,
      });
      subscribeSession();
      void startStudySegment(cfg).catch((e) => set({ error: (e as Error).message }));
    },

    finish: () => {
      if (unsub) { unsub(); unsub = null; }
      const s = useSessionStore.getState();
      if (s.phase === 'running' && s.session?.id) void s.end();
      s.reset();
      set({ running: false, segPhase: 'study' });
    },

    interrupt: () => {
      if (unsub) { unsub(); unsub = null; }
      const s = useSessionStore.getState();
      if ((s.phase === 'running' || s.phase === 'paused') && s.session?.id) void s.interrupt();
      s.reset();
      set({ running: false, segPhase: 'study', segIndex: 0, accumulatedStudySeconds: 0, totalStudySeconds: 0, segSession: null, error: null });
    },

    reset: () => {
      if (unsub) { unsub(); unsub = null; }
      useSessionStore.getState().reset();
      set({ running: false, segPhase: 'study', segIndex: 0, accumulatedStudySeconds: 0, totalStudySeconds: 0, segSession: null, error: null });
    },

    earlyBreak: () => {
      if (transitioning) return;
      if (!get().running || get().segPhase !== 'study') return;
      const s = useSessionStore.getState();
      if (s.phase !== 'running') return;
      void s.end(); // end 学习段 → 订阅触发进休息段
    },

    startNextStudy: () => {
      if (transitioning) return;
      if (!get().running || get().segPhase !== 'break') return;
      const s = useSessionStore.getState();
      if (s.phase === 'running') {
        void s.end(); // end 休息段 → 订阅触发下一学习段
      } else {
        // 休息段已 end(如暂停态), 直接开下一学习段
        const cfg = readCfg();
        transitioning = true;
        set({ segIndex: get().segIndex + 1, segPhase: 'study' });
        void startStudySegment(cfg).catch((e) => set({ error: (e as Error).message })).finally(() => { transitioning = false; });
      }
    },
  };
});

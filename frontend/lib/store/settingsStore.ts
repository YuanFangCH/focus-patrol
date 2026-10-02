'use client';

/**
 * 用户配置(本地持久化, localStorage key=aidushu-settings)
 * 核心项(劳动模式/巡查模式/巡查频率/时长/摄像头选择/摄像头常开)真实生效,
 * 滤镜/留档/校准等为 UI 占位(disabled + 即将上线)。
 * 注意: 配置存在设备本地, 换浏览器/设备需重设。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkMode = 'pomodoro' | 'unlimited';
export type PatrolFrequency = 'slow' | 'normal' | 'nightmare';

export interface SettingsState {
  /** 劳动模式: 番茄钟(限时+休整) / 无限时长(持续劳动) */
  workMode: WorkMode;
  /** 巡查模式 */
  patrolMode: 'off' | 'camera' | 'screen';
  /** 巡查频率 */
  patrolFrequency: PatrolFrequency;
  /** 黑白做旧滤镜(占位) */
  filmFilter: boolean;
  /** 劳动时长(分钟) */
  workMinutes: number;
  /** 休整时长(分钟, 仅存值, 后端无 break API) */
  breakMinutes: number;
  /** 长时间番茄钟: 是否启用(总时长=多段学习+休息) */
  longMode: boolean;
  /** 总学习时长(分钟, 所有学习段累计) */
  longTotalMinutes: number;
  /** 单段学习时长(分钟, 默认25) */
  longStudyMinutes: number;
  /** 单段休息时长(分钟, 默认5) */
  longBreakMinutes: number;
  /** 巡查判定留档(占位) */
  archiveEnabled: boolean;
  /** 选中的摄像头 deviceId(空=自动) */
  cameraDeviceId: string;
  /** 摄像头常开(巡查时界面实时显示自己的画面, 仅本机不可传输) */
  cameraPreview: boolean;

  set: (partial: Partial<SettingsState>) => void;
  reset: () => void;
}

const DEFAULTS: Omit<SettingsState, 'set' | 'reset'> = {
  workMode: 'pomodoro',
  patrolMode: 'off',
  patrolFrequency: 'normal',
  filmFilter: false,
  workMinutes: 25,
  breakMinutes: 5,
  longMode: false,
  longTotalMinutes: 120,
  longStudyMinutes: 25,
  longBreakMinutes: 5,
  archiveEnabled: true,
  cameraDeviceId: '',
  cameraPreview: false,
};

/** 默认配置导出(配置页「恢复默认」引用) */
export const SETTINGS_DEFAULTS = DEFAULTS;

/** persist 白名单: 只持久化所需字段(自动丢弃旧字段) */
const PERSIST_KEYS: Array<keyof SettingsState> = [
  'workMode', 'patrolMode', 'patrolFrequency', 'filmFilter',
  'workMinutes', 'breakMinutes', 'archiveEnabled',
  'longMode', 'longTotalMinutes', 'longStudyMinutes', 'longBreakMinutes',
  'cameraDeviceId', 'cameraPreview',
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (partial) => set(partial),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'aidushu-settings',
      partialize: (s) => {
        const out: Record<string, unknown> = {};
        for (const k of PERSIST_KEYS) out[k] = s[k];
        return out as Partial<SettingsState>;
      },
    },
  ),
);

'use client';

/**
 * 摄像头预览流共享(非持久化)
 * CameraPreview 获取的 MediaStream 通过这里传给巡查引擎复用,
 * 避免同一摄像头被预览组件和巡查引擎二次 getUserMedia 占用冲突。
 * 注意: 不 persist(MediaStream 不可序列化)。
 */

import { create } from 'zustand';

interface PreviewState {
  mediaStream: MediaStream | null;
  setStream: (stream: MediaStream | null) => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  mediaStream: null,
  setStream: (stream) => set({ mediaStream: stream }),
}));

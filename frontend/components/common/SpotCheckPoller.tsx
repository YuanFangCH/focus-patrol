'use client';

/**
 * 突击检查轮询器(无 UI)
 * 每 20s 轮询是否有管理员发起的突击检查任务;
 * 有则从当前摄像头流(优先复用 previewStore)截帧上传,供管理员侧 AI 判定。
 */

import { useEffect, useRef } from 'react';
import { patrolApi } from '@/lib/api/patrols';
import { usePreviewStore } from '@/lib/store/previewStore';
import { useAuthStore } from '@/lib/store/authStore';
import { frameToJpeg } from '@/lib/vision/fingerprint';

/** 从流截帧为 jpeg(压缩 quality 0.6, 控 <1MB) */
async function captureFromStream(stream: MediaStream): Promise<Blob | null> {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.style.display = 'none';
  document.body.appendChild(video);
  try {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => { video.removeEventListener('loadeddata', onReady); resolve(); };
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('error', () => reject(new Error('视频加载失败')));
      void video.play().catch(() => resolve()); // 无用户手势也可能自动播放(muted)
      setTimeout(onReady, 1500); // 兜底
    });
    return await frameToJpeg(video, 0.6);
  } catch {
    return null;
  } finally {
    video.srcObject = null;
    video.remove();
  }
}

export default function SpotCheckPoller() {
  const token = useAuthStore((s) => s.accessToken);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;

    const poll = async () => {
      if (!alive || inFlight.current) return;
      try {
        const r = await patrolApi.checkTask();
        if (!r.shouldCheck || !r.taskId) return;

        // 有任务: 从预览流截帧上传
        const stream = usePreviewStore.getState().mediaStream;
        if (!stream) return; // 无摄像头流, 等下次(用户可开常开)
        if (inFlight.current) return;
        inFlight.current = true;
        try {
          const blob = await captureFromStream(stream);
          if (blob) {
            await patrolApi.submitCheck(r.taskId, blob);
          }
        } finally {
          inFlight.current = false;
        }
      } catch {
        /* 轮询失败静默, 下次重试 */
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token]);

  return null;
}

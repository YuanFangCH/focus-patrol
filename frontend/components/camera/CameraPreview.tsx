'use client';

/**
 * 摄像头常开「小电视」组件
 * settings.cameraPreview 开启时, 在工作台显示复古小电视频实时显示摄像头。
 * 获取的流写入 previewStore, 供巡查引擎复用(避免二次占用摄像头)。
 *
 * iOS Safari 兼容: 摄像头必须在用户手势(点击)中请求, 否则不弹权限框。
 * 因此这里不再在 useEffect 自动请求, 而是显示「开启摄像头」按钮, 由用户点击触发。
 */

import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { usePreviewStore } from '@/lib/store/previewStore';
import { requestCameraStream, stopStream, normalizeCameraError, isCameraContextSecure } from '@/lib/vision/cameraAccess';

export default function CameraPreview() {
  const { cameraPreview, cameraDeviceId } = useSettingsStore();
  const mediaStream = usePreviewStore((s) => s.mediaStream);
  const setStream = usePreviewStore((s) => s.setStream);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // 组件卸载时释放流
  useEffect(
    () => () => {
      if (videoRef.current) videoRef.current.srcObject = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      setStream(null);
    },
    [setStream],
  );

  // mediaStream 变化时同步到 video 元素
  // (open() 成功时 video 可能尚未渲染, 需在挂载后补挂 srcObject)
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  // 用户手势中请求摄像头(iOS 必须点击触发)
  const open = async () => {
    if (opening) return;
    setError(null);
    setOpening(true);
    try {
      stopStream(streamRef.current);
      streamRef.current = null;
      setStream(null);
      const stream = await requestCameraStream({
        deviceId: cameraDeviceId || undefined,
        width: 640,
        height: 480,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStream(stream);
    } catch (e) {
      const err = normalizeCameraError(e);
      setError(err.message);
      console.warn('[camera-preview] 无法获取摄像头:', err.message);
    } finally {
      setOpening(false);
    }
  };

  const close = () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setError(null);
  };

  // 订阅 store 的 mediaStream state, 而非依赖 ref(赋值不触发重渲染)
  const hasStream = !!mediaStream;

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* 小电视频 */}
      <div className="relative bg-slate-900 rounded-2xl p-2 ring-2 ring-slate-700 shadow-lg overflow-hidden">
        {/* 顶部天线 */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex justify-center">
          <span className="block h-3 w-[2px] bg-slate-500" />
        </div>
        <div className="absolute -top-[9px] left-1/2 translate-x-4 h-2 w-2 rounded-full bg-red-500 shadow" />

        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
          {cameraPreview && hasStream && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}
          {cameraPreview && !hasStream && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              <p className="text-xs text-slate-400 text-center">
                {!isCameraContextSecure()
                  ? '摄像头需要 HTTPS 安全连接, 请通过 https:// 地址访问'
                  : '点击下方按钮开启摄像头预览'}
              </p>
              <button
                onClick={() => void open()}
                disabled={opening}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
              >
                {opening ? '开启中…' : '开启摄像头'}
              </button>
            </div>
          )}
          {cameraPreview && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              <p className="text-xs text-rose-300 text-center">{error}</p>
              <button
                onClick={() => void open()}
                disabled={opening}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
              >
                {opening ? '重试中…' : '重试'}
              </button>
            </div>
          )}
          {!cameraPreview && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-slate-500">摄像头预览未开启</p>
            </div>
          )}
          {cameraPreview && hasStream && (
            <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white font-medium">
              摄像头画面 · 仅本机可见
            </span>
          )}
        </div>

        {/* 底部底座架条 */}
        <div className="h-2 flex justify-center items-end">
          <span className="block h-1.5 w-16 bg-slate-700 rounded-b" />
        </div>
      </div>

      {/* 控制按钮: 已开启可关闭, 未开启可开启 */}
      {cameraPreview && (
        <div className="mt-2 flex justify-center">
          {hasStream ? (
            <button
              onClick={close}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              关闭摄像头
            </button>
          ) : (
            <button
              onClick={() => void open()}
              disabled={opening}
              className="text-xs text-brand-500 hover:text-brand-600 transition disabled:opacity-50"
            >
              {opening ? '开启中…' : '开启摄像头'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
'use client';

/**
 * 摄像头访问工具(统一处理 iOS Safari 兼容)
 *
 * iOS Safari 对 getUserMedia 有两个硬性要求, 不满足会「不弹权限框」直接失败:
 * 1. 必须 HTTPS(或 localhost) —— 非安全上下文直接拒绝
 * 2. 必须在用户手势(点击/tap)的调用栈内同步发起 —— useEffect/定时器里异步调用不弹框
 *
 * 因此所有摄像头请求都必须由「用户点击按钮」直接触发, 禁止在 useEffect 中自动调用。
 */

export type CameraErrorCode =
  | 'insecure' // 非 HTTPS, iOS 上无法使用摄像头
  | 'unsupported' // 浏览器不支持 mediaDevices
  | 'denied' // 用户拒绝权限
  | 'notfound' // 找不到摄像头
  | 'busy' // 摄像头被占用
  | 'unknown';

export interface CameraError {
  code: CameraErrorCode;
  message: string;
}

/** 将 getUserMedia 抛出的错误归一化为友好提示 */
export function normalizeCameraError(e: unknown): CameraError {
  const name = (e as DOMException)?.name ?? '';
  const message = (e as Error)?.message ?? String(e);
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return { code: 'denied', message: '摄像头权限被拒绝, 请在浏览器地址栏/设置中允许访问摄像头后重试' };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { code: 'notfound', message: '未检测到可用摄像头, 请检查设备是否连接' };
    case 'NotReadableError':
    case 'TrackStartError':
      return { code: 'busy', message: '摄像头被其他应用占用, 请关闭占用程序后重试' };
    case 'NotAllowedError':
      return { code: 'denied', message: '摄像头权限被拒绝, 请在浏览器设置中允许访问摄像头' };
    default:
      return { code: 'unknown', message: message || '无法访问摄像头' };
  }
}

/** 检查当前环境是否允许使用摄像头(HTTPS 或 localhost) */
export function isCameraContextSecure(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  // localhost / 127.0.0.1 视为安全上下文(部分浏览器 isSecureContext 已覆盖, 这里兜底)
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/**
 * 在用户手势中请求摄像头流。
 * 必须在点击事件处理函数内同步调用(可 await), 否则 iOS Safari 不弹权限框。
 */
export async function requestCameraStream(
  opts: { deviceId?: string; width?: number; height?: number } = {},
): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw { code: 'unsupported', message: '当前浏览器不支持摄像头访问' } as CameraError;
  }
  if (!isCameraContextSecure()) {
    throw {
      code: 'insecure',
      message: '摄像头需要 HTTPS 安全连接才能使用, 请通过 https:// 地址访问(或使用 localhost)',
    } as CameraError;
  }
  const constraints: MediaTrackConstraints = {
    width: { ideal: opts.width ?? 640 },
    height: { ideal: opts.height ?? 480 },
    facingMode: 'user',
  };
  if (opts.deviceId) {
    try {
      // exact 精确指定; 若该设备已失效(拔插)则降级用默认摄像头
      return await navigator.mediaDevices.getUserMedia({
        video: { ...constraints, deviceId: { exact: opts.deviceId } },
        audio: false,
      });
    } catch {
      // 指定设备不可用 → 降级默认
      return navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
    }
  }
  return navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
}

/** 停止并释放流 */
export function stopStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}
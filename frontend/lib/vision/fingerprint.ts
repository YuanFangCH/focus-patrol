'use client';

/**
 * 巡查客户端工具:
 * 1. computeFingerprint: 将视频帧降采样到 32x32 灰度并生成感知哈希(与后端视觉层解耦的本地预筛)
 * 2. fingerprintDiff: 两帧感知哈希的差异度(0~1)
 *
 * 设计目标: 本地预筛 → 画面显著变化才上传单帧到 /patrols/evaluate,
 * 避免每 10s 都上传, 节省带宽与 AI 调用成本。
 */

export interface VideoFrame {
  width: number;
  height: number;
  /** 32x32 灰度值数组(0~255) */
  gray: Uint8Array;
  /** 感知哈希: 32x32 二值化后的 1024 位, 存 Uint8Array(128 bytes) */
  hash: Uint8Array;
}

/** 把 ImageData 降采样为 32x32 灰度 */
export function downscaleToGray(image: ImageData, size = 32): Uint8Array {
  const { width, height, data } = image;
  const gray = new Uint8Array(size * size);
  const stepX = width / size;
  const stepY = height / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 采样区域中心的像素
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * stepX));
      const sy = Math.min(height - 1, Math.floor((y + 0.5) * stepY));
      const i = (sy * width + sx) * 4;
      // ITU-R BT.601 亮度
      gray[y * size + x] = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
      );
    }
  }
  return gray;
}

/** 由 32x32 灰度生成感知哈希(以均值为阈值二值化, 兼容亮度变化) */
export function grayToHash(gray: Uint8Array, size = 32): Uint8Array {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const avg = sum / gray.length;
  const hash = new Uint8Array(Math.ceil((size * size) / 8));
  for (let i = 0; i < gray.length; i++) {
    const bit = gray[i] >= avg ? 1 : 0;
    if (bit) hash[i >> 3] |= 0x80 >> (i & 7);
  }
  return hash;
}

/** 计算两帧感知哈希差异(0=相同, 1=完全不同) */
export function fingerprintDiff(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    // 异或后数 1 的个数
    let x = a[i] ^ b[i];
    while (x) {
      diff += x & 1;
      x >>= 1;
    }
  }
  return diff / (a.length * 8);
}

export interface FrameStats {
  /** 亮度均值 0~255 */
  mean: number;
  /** 亮度标准差 */
  stdDev: number;
}

export type FrameClass = 'black' | 'white' | 'solid' | 'normal';

/** 由 32x32 灰度数组计算亮度统计(均值/标准差), 供本地规则判定 */
export function frameStats(gray: Uint8Array): FrameStats {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const mean = sum / gray.length;
  let varSum = 0;
  for (let i = 0; i < gray.length; i++) {
    const d = gray[i] - mean;
    varSum += d * d;
  }
  return { mean, stdDev: Math.sqrt(varSum / gray.length) };
}

/**
 * 本地规则分类(无需 AI):
 * - black: 均值 < 8 (全黑/遮挡镜头)
 * - white: 均值 > 247 (全白/强光)
 * - solid: 标准差 < 6 (纯色/低纹理, 如对着白墙/桌面)
 * - normal: 其余
 */
export function classifyFrame(stats: FrameStats): FrameClass {
  if (stats.mean < 8) return 'black';
  if (stats.mean > 247) return 'white';
  if (stats.stdDev < 6) return 'solid';
  return 'normal';
}

/** 抽取当前帧为 ImageData(从 HTMLVideoElement 或 MediaStream 源) */
export function grabFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
): ImageData | null {
  let canvas: HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = source.videoWidth || 320;
    canvas.height = source.videoHeight || 240;
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  if (source instanceof HTMLVideoElement) {
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }
  try {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

/** 完整处理一帧: 抽取 → 降采样 → 哈希 */
export function computeFingerprint(
  source: HTMLVideoElement | HTMLCanvasElement,
): VideoFrame | null {
  const image = grabFrame(source);
  if (!image) return null;
  const gray = downscaleToGray(image);
  const hash = grayToHash(gray);
  return { width: image.width, height: image.height, gray, hash };
}

/** 把帧编码为 JPEG(blob), 用于上传 /patrols/evaluate */
export async function frameToJpeg(
  source: HTMLVideoElement | HTMLCanvasElement,
  quality = 0.7,
): Promise<Blob | null> {
  let canvas: HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = source.videoWidth || 320;
    canvas.height = source.videoHeight || 240;
  }
  if (source instanceof HTMLVideoElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      'image/jpeg',
      quality,
    );
  });
}

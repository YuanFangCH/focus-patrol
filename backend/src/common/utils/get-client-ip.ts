import { Request } from 'express';

/**
 * 获取客户端真实 IP。
 * 前端经本机一跳代理访问后端时, 真实客户端 IP 在 X-Forwarded-For。
 * main.ts 已设 trust proxy='loopback'(只信本机一跳), req.ip 已被 Express 解析为最左真实 IP;
 * 这里再对 XFF 首项做一次兜底解析, 兼容未走 loopback 的直连场景。
 * 注意: 本函数依赖 trust proxy 已信任的链路, 多级代理场景需要重新评估。
 */
export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0].trim().replace('::ffff:', '');
    if (first) return first;
  }
  return (req.ip ?? '').replace('::ffff:', '');
}

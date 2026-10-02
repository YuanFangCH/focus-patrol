import { Request } from 'express';

/**
 * 获取客户端真实 IP。
 * 本项目前端经 Next rewrites / proxy.js(8888) 反代 → 后端, 真实客户端 IP 在 X-Forwarded-For。
 * main.ts 已设 trust proxy='loopback'(只信本机一跳), req.ip 已被 Express 解析为最左真实 IP;
 * 这里再对 XFF 首项做一次兜底解析, 兼容未走 loopback 的直连场景。
 * 注意: 不要盲目私有化 XFF 首项到生产多级代理, 本函数依赖 trust proxy 已信任的链路。
 */
export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0].trim().replace('::ffff:', '');
    if (first) return first;
  }
  return (req.ip ?? '').replace('::ffff:', '');
}

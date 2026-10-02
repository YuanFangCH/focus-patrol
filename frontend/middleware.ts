import { NextRequest, NextResponse } from 'next/server';

/**
 * 管理面板访问守卫
 * /admin/* 仅允许本机/局域网 Host 访问(管理面板部署在独立进程 3002,绑 127.0.0.1);
 * 经公网隧道(proxy.js 8888 → 3000)访问 /admin 一律重定向回首页。
 */
const LAN_HOST = /^(localhost|127\.0\.0\.1|::1|\[::1\])(:\d+)?$/;
const LAN_IP = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  // 去掉端口比较主机名部分
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const isLocal =
    LAN_HOST.test(host) || LAN_IP.test(hostname) || hostname === 'localhost';
  if (!isLocal) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

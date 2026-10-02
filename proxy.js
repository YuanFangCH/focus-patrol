#!/usr/bin/env node
/**
 * AI 督学馆本地反向代理
 *
 * 用途: SakuraFrp TCP 隧道(非内地节点 + frpc 自动 HTTPS)只穿一个入口端口,
 *       由本代理分流到内网两个服务,单地址一站直达。
 *
 * 路由:
 *   /api/admin/*   → 403 拦截(建号仅限本机直连 3001,防 LocalIpGuard 被隧道穿透)
 *   /api/*         → 127.0.0.1:3001 (NestJS 后端)
 *   其余            → 127.0.0.1:3000 (Next.js 前端)
 *
 * 特性: 流式转发(支持违纪快照大 body)、透传 method/headers、502 兜底、时间戳日志
 */
const http = require('http');

const PORT = Number(process.env.PROXY_PORT) || 8888;
const HOST = process.env.PROXY_HOST || '127.0.0.1';
const API_UPSTREAM = { host: '127.0.0.1', port: Number(process.env.API_PORT) || 3001 };
const WEB_UPSTREAM = { host: '127.0.0.1', port: Number(process.env.WEB_PORT) || 3000 };

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[proxy ${ts}] ${msg}`);
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // 1. admin 拦截: 建号接口只允许本机直连 3001,经隧道一律拒绝
  if (url.startsWith('/api/admin')) {
    log(`BLOCK /api/admin* ${method} ${url}`);
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 403, data: null, message: '管理接口仅限本机访问' }));
    return;
  }

  // 2. 分流
  const upstream = url.startsWith('/api') ? API_UPSTREAM : WEB_UPSTREAM;
  log(`→ ${upstream.port} ${method} ${url}`);

  const proxyReq = http.request(
    {
      host: upstream.host,
      port: upstream.port,
      path: url,
      method,
      headers: { ...req.headers },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (e) => {
    log(`✗ ${upstream.port} ${url} → ${e.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 502, data: null, message: '上游服务不可用' }));
    } else {
      res.end();
    }
  });

  // 流式转发请求体(违纪快照上传是大 body)
  req.pipe(proxyReq);
});

server.listen(PORT, HOST, () => {
  log(`listening on http://${HOST}:${PORT}`);
  log(`  /api/admin/* → 403 (blocked)`);
  log(`  /api/*       → http://${API_UPSTREAM.host}:${API_UPSTREAM.port}`);
  log(`  else         → http://${WEB_UPSTREAM.host}:${WEB_UPSTREAM.port}`);
});

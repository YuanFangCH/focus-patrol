#!/usr/bin/env node
/**
 * 管理 CLI:创建账号并生成唯一 uid(8 位短码)
 *
 * 通过本机管理接口 POST /api/admin/users 创建(LocalIpGuard 仅允许本机/局域网 IP,
 * 公网不可调用,符合"仅后端添加账号")。
 *
 * 用法(在 backend 目录下执行,需后端已启动):
 *   node scripts/create-user.js --nickname 小明              # 建 1 个
 *   node scripts/create-user.js --nickname 小明 --count 5    # 批量 5 个
 *   node scripts/create-user.js --count 3 --json             # 输出 JSON 便于分发
 *   node scripts/create-user.js --url http://localhost:3001  # 自定义后端地址
 *
 * uid 字符集:ABCDEFGHJKMNPQRSTUVWXYZ23456789(排除 0/O/1/I),由后端生成。
 */
const http = require('http');

// ---------- 参数解析 ----------
function parseArgs(argv) {
  const args = { nickname: '督学员', count: 1, json: false, url: 'http://localhost:3001' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--nickname') args.nickname = argv[++i] ?? '督学员';
    else if (a === '--count') args.count = Math.min(parseInt(argv[++i] ?? '1', 10) || 1, 100);
    else if (a === '--json') args.json = true;
    else if (a === '--url') args.url = argv[++i] ?? 'http://localhost:3001';
    else if (a === '--help' || a === '-h') {
      console.log(
        '用法: node scripts/create-user.js [--nickname 名称] [--count N] [--json] [--url http://localhost:3001]\n' +
        '  通过后端本机管理接口创建账号(后端需已启动)',
      );
      process.exit(0);
    }
  }
  return args;
}

// ---------- HTTP 请求 ----------
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, json: null, raw: data });
          }
        });
      },
    );
    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

// ---------- 主流程 ----------
async function main() {
  const args = parseArgs(process.argv);
  const apiUrl = `${args.url.replace(/\/$/, '')}/api/admin/users`;

  let resp;
  try {
    resp = await postJson(apiUrl, { nickname: args.nickname, count: args.count });
  } catch (e) {
    console.error(`✗ 无法连接后端(${apiUrl}): ${e.message}\n  请确认后端已启动(node dist/main.js)。`);
    process.exit(1);
  }

  if (resp.status !== 201 && resp.status !== 200) {
    console.error(`✗ 接口返回 ${resp.status}: ${JSON.stringify(resp.json ?? resp.raw ?? '').slice(0, 300)}`);
    process.exit(1);
  }

  const accounts = resp.json?.data?.accounts ?? [];
  if (args.json) {
    console.log(JSON.stringify(accounts.map((a) => ({ uid: a.uid, nickname: a.nickname })), null, 2));
  } else {
    for (const a of accounts) {
      console.log(`✅ 创建账号 uid=${a.uid} nickname=${a.nickname} (id=${a.id})`);
    }
    console.log(`\n共创建 ${accounts.length} 个账号,请将 uid 分发给用户。`);
  }
}

main().catch((e) => {
  console.error('✗ 创建失败:', e.message);
  process.exit(1);
});

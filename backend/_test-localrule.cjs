/** 临时测试: 验证 local-rule 违纪帧带图上传留档(自动上传后端快照) */
const { spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const zlib = require('node:zlib');

const BASE = 'http://localhost:3001/api';

function req(method, path, headers = {}, body) {
  const args = ['-s', '-X', method, BASE + path];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  return JSON.parse(spawnSync('curl', args, { encoding: 'utf8' }).stdout);
}

function noisePng(seed) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
  const chunk = (t, d) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const tb = Buffer.from(t);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([tb, d])) >>> 0);
    return Buffer.concat([len, tb, d, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(64, 0); ihdr.writeUInt32BE(48, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(48 * (1 + 64 * 3));
  for (let y = 0; y < 48; y++) {
    raw[y * (1 + 64 * 3)] = 0;
    for (let x = 0; x < 64; x++) {
      const o = y * (1 + 64 * 3) + 1 + x * 3;
      raw[o] = Math.floor(rand() * 256);
      raw[o + 1] = Math.floor(rand() * 256);
      raw[o + 2] = Math.floor(rand() * 256);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

(async () => {
  // 1. 建号 + 登录
  const created = req('POST', '/admin/users', {}, { nickname: 'E2E留档', count: 1 });
  const uid = created.data.accounts[0].uid;
  const login = req('POST', '/auth/login', {}, { uid });
  const tok = login.data.accessToken;
  console.log('✓ 建号并登录, userId =', login.data.user.id);

  // 2. 创建会话
  const sess = req('POST', '/sessions', { Authorization: `Bearer ${tok}` }, { durationMinutes: 25, mode: 'camera' });
  const sid = sess.data.session.id;
  console.log('✓ 创建会话', sid);

  // 3. local-rule 带图上传(模拟前端本地规则违纪帧留档上传)
  const imgPath = join(tmpdir(), 'localrule-archive.png');
  writeFileSync(imgPath, noisePng(42));
  const out = spawnSync('curl', [
    '-s', '-X', 'POST',
    `${BASE}/patrols/local-rule?sessionId=${sid}&source=camera&rule=occluded-black&result=away`,
    '-H', `Authorization: Bearer ${tok}`,
    '-F', `image=@${imgPath};type=image/png`,
  ], { encoding: 'utf8' });
  let verdict;
  try { verdict = JSON.parse(out.stdout); } catch { console.log('✗ 响应非 JSON:', out.stdout.slice(0, 200)); process.exit(1); }
  const v = verdict.data ?? verdict;
  console.log('✓ local-rule 判定:', JSON.stringify(v));
  if (v.snapshotUrl) {
    console.log('✓ 违纪帧已自动上传后端留档: snapshotUrl =', v.snapshotUrl);
    const snap = spawnSync('curl', ['-s', '-o', 'NUL', '-w', '%{http_code}', `http://localhost:3001${v.snapshotUrl}`], { encoding: 'utf8' });
    console.log('✓ 快照文件可访问:', snap.stdout);
    console.log('✓ 本地规则违纪帧留档全链路通过');
  } else {
    console.log('✗ snapshotUrl 为空, 留档上传失败');
  }
})();

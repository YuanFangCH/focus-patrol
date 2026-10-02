/**
 * 端到端巡查测试: 模拟前端真实请求(游客登录 → 创建会话 → FormData multipart 上传判定)
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';

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

// 1. 建号 + uid 登录
const created = req('POST', '/admin/users', {}, { nickname: 'E2E巡查', count: 1 });
const uid = created.data.accounts[0].uid;
const login = req('POST', '/auth/login', {}, { uid });
const tok = login.data.accessToken;
console.log('✓ 建号并登录, userId =', login.data.user.id, 'uid =', uid);

// 2. 创建会话
const sess = req('POST', '/sessions', { Authorization: `Bearer ${tok}` }, { durationMinutes: 25, mode: 'camera' });
const sid = sess.data.session.id;
console.log('✓ 创建会话', sid);

// 3. FormData 上传(与前端 patrolApi.evaluate 完全一致)
const imgPath = join(tmpdir(), 'e2e-patrol.png');
writeFileSync(imgPath, noisePng(7));
const out = spawnSync('curl', [
  '-s', '-X', 'POST',
  `${BASE}/patrols/evaluate?sessionId=${sid}&source=camera`,
  '-H', `Authorization: Bearer ${tok}`,
  '-F', `image=@${imgPath};type=image/png`,
], { encoding: 'utf8' });
const verdict = JSON.parse(out.stdout);
console.log('✓ 判定结果:', JSON.stringify(verdict.data ?? verdict).slice(0, 200));
console.log(verdict.code === 0 ? '✓ E2E multipart 全链路通过' : '✗ E2E 失败');

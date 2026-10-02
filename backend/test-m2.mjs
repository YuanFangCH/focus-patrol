/**
 * M2 验收脚本：巡查全链路测试
 * 1. 游客登录拿 token
 * 2. 创建 camera 模式会话
 * 3. 用纯 JS 生成 3 张不同颜色的合法 PNG（zlib deflate，无需 Canvas）
 * 4. 逐张 multipart 上传 /api/patrols/evaluate 判定
 * 5. 验证 patrol_records 落库、违纪快照留存/查看/删除、会话统计更新
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import zlib from 'node:zlib';

const BASE = 'http://localhost:3001/api';
const TMP = join(tmpdir(), 'm2-test-' + Date.now());

// ---------- 工具 ----------
function sh(args, opts = {}) {
  const res = spawnSync('curl', args, { encoding: 'utf8', timeout: 30000, ...opts });
  if (res.error) throw res.error;
  return res.stdout;
}

function jsonReq(method, path, { headers = {}, body } = {}) {
  const args = ['-s', '-X', method, `${BASE}${path}`];
  if (body !== undefined) {
    args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  }
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  const out = sh(args);
  try { return JSON.parse(out); } catch { return { raw: out.slice(0, 300) }; }
}

/** 生成指定颜色的合法 PNG */
function makePng(r, g, b, w = 32, h = 32) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const off = row + 1 + x * 3;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function uploadPatrol(token, sessionId, filePath, source = 'camera') {
  const out = sh([
    '-s', '-X', 'POST',
    `${BASE}/patrols/evaluate?sessionId=${sessionId}&source=${source}`,
    '-H', `Authorization: Bearer ${token}`,
    '-F', `image=@${filePath};type=image/png`,
  ]);
  try { return JSON.parse(out); } catch { return { raw: out.slice(0, 400) }; }
}

// ---------- 1. 游客登录 ----------
const login = jsonReq('POST', '/auth/guest', { body: {} });
if (!login.data?.accessToken) {
  console.error('✗ 游客登录失败:', JSON.stringify(login).slice(0, 300));
  process.exit(1);
}
const TOKEN = login.data.accessToken;
console.log('✓ 游客登录成功, userId =', login.data.user?.id);

// ---------- 2. 创建 camera 会话 ----------
const sess = jsonReq('POST', '/sessions', {
  headers: { Authorization: `Bearer ${TOKEN}` },
  body: { durationMinutes: 25, mode: 'camera' },
});
const sid = sess.data?.session?.id;
if (!sid) {
  console.error('✗ 创建会话失败:', JSON.stringify(sess).slice(0, 300));
  process.exit(1);
}
console.log('✓ 会话创建成功, sessionId =', sid);

// ---------- 3. 生成 3 张不同颜色测试图并逐张判定 ----------
const colors = [[220, 40, 40], [40, 180, 90], [60, 80, 220]]; // 红 / 绿 / 蓝
const results = [];
for (let i = 0; i < colors.length; i++) {
  const [r, g, b] = colors[i];
  const file = `${TMP}-${i}.png`;
  writeFileSync(file, makePng(r, g, b));
  const resp = uploadPatrol(TOKEN, sid, file, 'camera');
  try { unlinkSync(file); } catch { /* 临时文件，忽略 */ }
  results.push({ image: i + 1, color: `rgb(${r},${g},${b})`, resp });
  console.log(`  第${i + 1}张(${r},${g},${b}):`, JSON.stringify(resp).slice(0, 200));
}

const ok = results.filter((x) => x.resp.data?.patrolId);
if (ok.length === 0) {
  console.error('✗ 全部上传失败，终止');
  process.exit(1);
}
console.log(`✓ ${ok.length}/${results.length} 张图片成功返回判定`);

// ---------- 4. 构造一张必然命中违纪的图片(模拟 Mock 哈希) ----------
function mockHash(image) {
  let hash = 0;
  for (let i = 0; i < image.length; i += 97) {
    hash = ((hash << 5) - hash + image[i]) | 0;
  }
  return Math.abs(hash);
}
/** 生成带噪点的随机图案 PNG(压缩流不可预测,哈希多样) */
function makeNoisePng(seed, w = 64, h = 48) {
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff, s / 0x7fffffff);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const off = row + 1 + x * 3;
      raw[off] = Math.floor(rand() * 256);
      raw[off + 1] = Math.floor(rand() * 256);
      raw[off + 2] = Math.floor(rand() * 256);
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function findViolationPng() {
  for (let seed = 1; seed <= 500; seed++) {
    const buf = makeNoisePng(seed);
    const rnd = mockHash(buf) % 100;
    if (rnd >= 55) return { buf, seed, rnd };
  }
  return null;
}

// ---------- 5. 上传违纪帧并验证快照留存/查看/删除 ----------
const found = findViolationPng();
if (!found) {
  console.error('✗ 无法构造违纪测试图');
  process.exit(1);
}
console.log(`✓ 找到违纪噪点图 seed=${found.seed} (rnd=${found.rnd}%), 上传判定...`);
const file = `${TMP}-vio.png`;
writeFileSync(file, found.buf);
const vioResp = uploadPatrol(TOKEN, sid, file, 'camera');
try { unlinkSync(file); } catch { /* 忽略 */ }

if (vioResp.data?.isViolation && vioResp.data?.snapshotUrl) {
  const patrolId = vioResp.data.patrolId;
  const snapshotUrl = vioResp.data.snapshotUrl;
  console.log(`✓ 违纪帧判定成功 patrolId=${patrolId}, snapshotUrl=${snapshotUrl}`);

  // 5a. 查看快照(图片流)
  const snap = sh(['-s', '-o', `${TMP}-snap.bin`, '-w', '%{http_code}', `${BASE}/patrols/${patrolId}/snapshot`,
    '-H', `Authorization: Bearer ${TOKEN}`]);
  const snapSize = statSync(`${TMP}-snap.bin`).size;
  console.log(`  快照 GET → HTTP ${snap}, 大小 ${snapSize} bytes (期望 200)`);

  // 5b. 删除快照
  const del = jsonReq('DELETE', `/patrols/${patrolId}/snapshot`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  console.log('  快照 DELETE →', JSON.stringify(del).slice(0, 120));

  // 5c. 删除后再取应 404
  const after = sh(['-s', '-o', '/dev/null', '-w', '%{http_code}', `${BASE}/patrols/${patrolId}/snapshot`,
    '-H', `Authorization: Bearer ${TOKEN}`]);
  console.log(`  删除后快照 GET → HTTP ${after} (期望 404)`);
} else {
  console.log('✗ 违纪帧上传未命中,响应:', JSON.stringify(vioResp).slice(0, 300));
}

// ---------- 6. 会话统计 ----------
const detail = jsonReq('GET', `/sessions/${sid}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const s = detail.data?.session || detail.data;
console.log('✓ 会话统计 → patrolCount =', s?.patrolCount, ', violationCount =', s?.violationCount);

console.log('\n========== M2 验收脚本执行完毕 ==========');

/** 验证违纪快照经反代全链路: 建号直连3001, 其余走8888 */
const { spawnSync } = require('child_process');
const zlib = require('zlib');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROXY = 'http://127.0.0.1:8888/api';
const DIRECT = 'http://127.0.0.1:3001/api';

function req(base, method, p, headers = {}, body) {
  const args = ['-s', '-X', method, base + p];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  return JSON.parse(spawnSync('curl', args, { encoding: 'utf8' }).stdout);
}
function mockHash(image) { let h = 0; for (let i = 0; i < image.length; i += 97) h = ((h << 5) - h + image[i]) | 0; return Math.abs(h); }
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

// 本地找违纪 seed (rnd>=55)
let found = null;
for (let seed = 1; seed <= 300; seed++) {
  const b = noisePng(seed);
  if (mockHash(b) % 100 >= 55) { found = { seed, rnd: mockHash(b) % 100 }; break; }
}
console.log('违纪 seed:', found ? JSON.stringify(found) : '未找到');
if (!found) process.exit(1);

const imgPath = path.join(os.tmpdir(), 'snap-viol.png');
fs.writeFileSync(imgPath, noisePng(found.seed));

const created = req(DIRECT, 'POST', '/admin/users', {}, { nickname: '快照验收4', count: 1 });
const uid = created.data.accounts[0].uid;
const login = req(PROXY, 'POST', '/auth/login', {}, { uid });
const tok = login.data.accessToken;
const sess = req(PROXY, 'POST', '/sessions', { Authorization: `Bearer ${tok}` }, { durationMinutes: 25, mode: 'camera' });
const sid = sess.data.session.id;

const out = spawnSync('curl', [
  '-s', '-X', 'POST',
  `${PROXY}/patrols/evaluate?sessionId=${sid}&source=camera`,
  '-H', `Authorization: Bearer ${tok}`,
  '-F', `image=@${imgPath};type=image/png`,
], { encoding: 'utf8' });
const v = JSON.parse(out.stdout);
console.log('判定:', v.data?.result, 'isViolation:', v.data?.isViolation, 'snapshotUrl:', v.data?.snapshotUrl ?? '无');
if (v.data?.snapshotUrl) {
  const snap = spawnSync('curl', [
    '-s', '-o', '/dev/null', '-w', '%{http_code} %{size_download}',
    '-X', 'GET', `${PROXY}/patrols/${v.data.patrolId}/snapshot`,
    '-H', `Authorization: Bearer ${tok}`,
  ], { encoding: 'utf8' });
  console.log('快照经反代读取:', snap.stdout, '(期望 200 + bytes)');
}

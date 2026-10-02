/**
 * M3 验收脚本: 荣誉结算 + 好友互关 + 在线心跳 + 通知 全链路
 * 1. 通过本机 admin 接口建两个用户 A/B(uid 登录)
 * 2. A 完成会话 → 验证 exp 累加、levelUp 字段、first_session 成就
 * 3. A→B 发好友申请 → B 收到通知 → B 接受 → A 收到通知
 * 4. A ping 心跳 → B 查 A 在线 → B leave → A 不在线
 * 5. 通知列表/已读
 */
import { spawnSync } from 'node:child_process';

const BASE = 'http://localhost:3001/api';

function sh(args) {
  const res = spawnSync('curl', args, { encoding: 'utf8', timeout: 30000 });
  if (res.error) throw res.error;
  return res.stdout;
}
function req(method, path, { headers = {}, body } = {}) {
  const args = ['-s', '-X', method, `${BASE}${path}`];
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  const out = sh(args);
  try { return JSON.parse(out); } catch { return { raw: out.slice(0, 300) }; }
}
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

/** 通过本机 admin 接口建号并登录,返回 { token, uid, id } */
function createAndLogin(nickname) {
  const created = req('POST', '/admin/users', { body: { nickname, count: 1 } });
  if (created.code !== 0) throw new Error(`建号失败: ${JSON.stringify(created).slice(0, 200)}`);
  const { uid } = created.data.accounts[0];
  const login = req('POST', '/auth/login', { body: { uid } });
  if (login.code !== 0) throw new Error(`登录失败: ${JSON.stringify(login).slice(0, 200)}`);
  return { token: login.data.accessToken, uid, id: login.data.user.id };
}

// ---- 1. 建用户 A/B ----
const A = createAndLogin('回归A');
const B = createAndLogin('回归B');
const TA = A.token, TB = B.token;
const IDA = A.id, IDB = B.id;
console.log(`✓ 用户 A=${IDA.slice(0, 8)}…(uid=${A.uid}) B=${IDB.slice(0, 8)}…(uid=${B.uid})`);

// ---- 2. A 完成一个会话 → 经验/成就 ----
const s1 = req('POST', '/sessions', { headers: { Authorization: `Bearer ${TA}` }, body: { durationMinutes: 25, mode: 'off' } });
const sid = s1.data.session.id;
const end1 = req('POST', `/sessions/${sid}/end`, { headers: { Authorization: `Bearer ${TA}` }, body: { actualSeconds: 1500 } });
check('会话结束返回 expGained', end1.data?.expGained === 20, `expGained=${end1.data?.expGained}`);
check('返回 unlockedAchievements', Array.isArray(end1.data?.unlockedAchievements), JSON.stringify(end1.data?.unlockedAchievements ?? []).slice(0, 80));
check('first_session 成就解锁', end1.data?.unlockedAchievements?.some((a) => a.code === 'first_session'));

const me1 = req('GET', '/honor/me', { headers: { Authorization: `Bearer ${TA}` } });
check('honor/me 经验=20', me1.data?.exp === 20, `exp=${me1.data?.exp}`);
check('honor/me 有成就', me1.data?.achievements?.length >= 1);

// ---- 3. A→B 好友申请 → 通知 → 接受 ----
const fr = req('POST', '/social/requests', { headers: { Authorization: `Bearer ${TA}` }, body: { userId: IDB } });
check('A 发好友申请', fr.code === 0);

const notifB = req('GET', '/notifications', { headers: { Authorization: `Bearer ${TB}` } });
check('B 收到好友申请通知', notifB.data?.list?.some((n) => n.type === 'friend_request' && n.relatedId === IDA), `unread=${notifB.data?.unread}`);

const reqsB = req('GET', '/social/requests', { headers: { Authorization: `Bearer ${TB}` } });
const rid = reqsB.data?.requests?.[0]?.id;
check('B 看到申请列表', !!rid);
const accept = req('POST', `/social/requests/${rid}/accept`, { headers: { Authorization: `Bearer ${TB}` }, body: {} });
check('B 接受申请', accept.code === 0);

const notifA = req('GET', '/notifications', { headers: { Authorization: `Bearer ${TA}` } });
check('A 收到同意通知', notifA.data?.list?.some((n) => n.type === 'friend_accepted'));

const friendsA = req('GET', '/social/friends', { headers: { Authorization: `Bearer ${TA}` } });
const friendsB = req('GET', '/social/friends', { headers: { Authorization: `Bearer ${TB}` } });
check('A 好友列表含 B', friendsA.data?.friends?.some((f) => f.id === IDB));
check('B 好友列表含 A', friendsB.data?.friends?.some((f) => f.id === IDA));

// ---- 4. 在线心跳 ----
const pingA = req('POST', '/track/ping', { headers: { Authorization: `Bearer ${TA}` }, body: { sessionId: sid } });
check('A ping 心跳', pingA.code === 0, `online=${pingA.data?.count}`);
const onlineB = req('GET', `/track/online?userIds=${IDA},${IDB}`, { headers: { Authorization: `Bearer ${TB}` } });
check('B 看到 A 在线', onlineB.data?.online?.includes(IDA), `online=${JSON.stringify(onlineB.data?.online)}`);
const leaveB = req('POST', '/track/leave', { headers: { Authorization: `Bearer ${TB}` }, body: {} });
check('B leave', leaveB.code === 0);
const onlineA = req('GET', `/track/online?userIds=${IDB}`, { headers: { Authorization: `Bearer ${TA}` } });
check('A 看不到 B(B 已离开)', !onlineA.data?.online?.includes(IDB));

// ---- 5. 通知已读 ----
const nid = notifA.data?.list?.[0]?.id;
const read = req('POST', `/notifications/${nid}/read`, { headers: { Authorization: `Bearer ${TA}` }, body: {} });
check('通知单条已读', read.code === 0);
const readAll = req('POST', '/notifications/read-all', { headers: { Authorization: `Bearer ${TA}` }, body: {} });
check('通知全部已读', readAll.code === 0);
const notifA2 = req('GET', '/notifications', { headers: { Authorization: `Bearer ${TA}` } });
check('未读数归零', notifA2.data?.unread === 0, `unread=${notifA2.data?.unread}`);

// ---- 重复申请保护 ----
const dup = req('POST', '/social/requests', { headers: { Authorization: `Bearer ${TA}` }, body: { userId: IDB } });
check('重复加好友被拒(已是好友)', dup.code !== 0, dup.message?.slice(0, 40) ?? '');

console.log(`\n========== M3 验收: ${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);

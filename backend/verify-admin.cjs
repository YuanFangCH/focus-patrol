/** admin API 完整验证: 建号→登录→产生数据→详情→改昵称→禁用踢线→删除级联 */
const { spawnSync } = require('child_process');
const B = 'http://127.0.0.1:3001/api';
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
}
function req(method, p, { headers = {}, body } = {}) {
  const args = ['-s', '-X', method, B + p];
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  const out = spawnSync('curl', args, { encoding: 'utf8' }).stdout;
  try { return JSON.parse(out); } catch { return { raw: out.slice(0, 200) }; }
}

// 1. 建号
const c = req('POST', '/admin/users', { body: { nickname: '管理面板测试', count: 1 } });
const uid = c.data.accounts[0].uid;
const id = c.data.accounts[0].id;
console.log(`建号 uid=${uid} id=${id.slice(0, 8)}…`);
check('建号成功', c.code === 0 && /^[A-HJKMNP-Z2-9]{8}$/.test(uid));

// 2. 登录
const login = req('POST', '/auth/login', { body: { uid } });
const tok = login.data.accessToken;
check('登录成功', login.code === 0);

// 3. 产生数据: 建会话并结束(加分)、好友申请等
const s = req('POST', '/sessions', { headers: { Authorization: `Bearer ${tok}` }, body: { durationMinutes: 25, mode: 'off' } });
const sid = s.data.session.id;
const e = req('POST', `/sessions/${sid}/end`, { headers: { Authorization: `Bearer ${tok}` }, body: { actualSeconds: 1500 } });
check('会话完成 expGained=20', e.data?.expGained === 20, `exp=${e.data?.expGained}`);

// 4. 搜索(此时昵称还是「管理面板测试」)
const search = req('GET', `/admin/users?keyword=${encodeURIComponent('管理面板测试')}`, {});
check('keyword 搜索命中', search.data?.total >= 1, `total=${search.data?.total}`);
const searchUid = req('GET', `/admin/users?keyword=${uid}`, {});
check('keyword 按 uid 搜索', searchUid.data?.total >= 1);
const statusFilter = req('GET', '/admin/users?status=1&size=1', {});
check('status=1 过滤', statusFilter.data?.list?.every((u) => u.status === 1));

// 5. 详情聚合
const detail = req('GET', `/admin/users/${id}`, {});
const d = detail.data;
check('详情返回用户', d?.user?.uid === uid);
check('详情 counts.sessions>=1', d?.counts?.sessions >= 1, `sessions=${d?.counts?.sessions}`);
check('详情 counts.completed>=1', d?.counts?.completed >= 1);
check('详情 counts.achievements>=1', d?.counts?.achievements >= 1, `ach=${d?.counts?.achievements}`);
check('详情有最近会话', Array.isArray(d?.recentSessions) && d.recentSessions.length >= 1);
check('详情有等级名', typeof d?.user?.honorLevelName === 'string');

// 6. 改昵称
const rename = req('PATCH', `/admin/users/${id}`, { body: { nickname: '改名成功' } });
check('改昵称 ok', rename.code === 0);
const detail2 = req('GET', `/admin/users/${id}`, {});
check('昵称已更新', detail2.data?.user?.nickname === '改名成功');

// 7. 禁用 → 踢下线
const disable = req('PATCH', `/admin/users/${id}`, { body: { status: 0 } });
check('禁用 ok', disable.code === 0);
const afterDisable = req('GET', '/sessions', { headers: { Authorization: `Bearer ${tok}` } });
check('禁用后旧 token 401(踢下线)', afterDisable.code === 401, `code=${afterDisable.code}`);
const relogin = req('POST', '/auth/login', { body: { uid } });
check('禁用后无法再登录', relogin.code === 401);
// 重新启用
const enable = req('PATCH', `/admin/users/${id}`, { body: { status: 1 } });
check('重新启用 ok', enable.code === 0);

// 8. 删除 → 级联
const del = req('DELETE', `/admin/users/${id}`, {});
check('删除 ok', del.code === 0);
const gone = req('GET', `/admin/users/${id}`, {});
check('删除后查不到', gone.code === 404);
const relogin2 = req('POST', '/auth/login', { body: { uid } });
check('删除后无法登录', relogin2.code === 401);

// 9. 删除后关联表清理验证(直接查库)
const fs = require('fs');
const initSqlJs = require('sql.js');
(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('data/aidushu.sqlite'));
  const tables = [
    ['focus_sessions', 'user_id'],
    ['patrol_records', 'user_id'],
    ['violation_snapshots', 'user_id'],
    ['notifications', 'user_id'],
    ['refresh_tokens', 'user_id'],
    ['user_achievements', 'user_id'],
  ];
  for (const [t, col] of tables) {
    const r = db.exec(`SELECT COUNT(*) FROM ${t} WHERE ${col} = '${id}'`);
    const n = r.length ? r[0].values[0][0] : 0;
    check(`级联清理 ${t}=0`, n === 0, `${t}=${n}`);
  }
  // friendships 用 requester_id/addressee_id
  const fr = db.exec(`SELECT COUNT(*) FROM friendships WHERE requester_id = '${id}' OR addressee_id = '${id}'`);
  const frn = fr.length ? fr[0].values[0][0] : 0;
  check('级联清理 friendships=0', frn === 0, `friendships=${frn}`);
  db.close();
  console.log(`\n========== admin API 验证: ${pass} 通过 / ${fail} 失败 ==========`);
  process.exit(fail > 0 ? 1 : 0);
})();

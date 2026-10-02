const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const file = process.env.DB_FILE || path.join(__dirname, 'data', 'aidushu.sqlite');
initSqlJs().then((SQL) => {
  const db = new SQL.Database(fs.readFileSync(file));
  const res = db.exec(
    `SELECT id, patrol_count, violation_count, status, mode FROM focus_sessions ORDER BY created_at DESC LIMIT 3`
  );
  if (res.length === 0) { console.log('无会话'); return; }
  const cols = res[0].columns;
  for (const row of res[0].values) {
    const obj = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    console.log(JSON.stringify(obj));
  }
  const r2 = db.exec(
    `SELECT COUNT(*) AS patrols FROM patrol_records; SELECT COUNT(*) AS violations FROM violation_snapshots;`
  );
  console.log('patrol_records 总数:', r2[0].values[0][0], '| violation_snapshots 总数:', r2[1].values[0][0]);
});

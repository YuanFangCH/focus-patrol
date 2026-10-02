require('reflect-metadata');
const { DataSource } = require('typeorm');
const initSqlJs = require('sql.js');
const { FocusSession } = require('./dist/entities/focus-session.entity.js');

(async () => {
  const SQL = await initSqlJs();
  const ds = new DataSource({
    type: 'sqljs',
    driver: SQL,
    autoSave: false,
    entities: [FocusSession],
    synchronize: true,
    logging: true,
  });
  await ds.initialize();
  const repo = ds.getRepository(FocusSession);
  try {
    await repo.save(repo.create({
      userId: 'test-user',
      status: 'running',
      durationMinutes: 25,
      mode: 'off',
    }));
    console.log('INSERT OK');
  } catch (e) {
    console.log('INSERT FAIL:', e.message);
  }
  await ds.destroy();
})();

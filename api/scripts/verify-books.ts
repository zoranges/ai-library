import { initDatabase, queryAll } from '../db/database.js';

async function check() {
  await initDatabase();
  const result = await queryAll("SELECT COUNT(*) as cnt FROM books");
  console.log('Remaining books:', result[0].cnt);
  const noCover = await queryAll("SELECT COUNT(*) as cnt FROM books WHERE coverUrl IS NULL OR coverUrl = ''");
  console.log('Without cover:', noCover[0].cnt);
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

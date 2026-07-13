import { initDatabase, run } from '../db/database.js';

async function main() {
  await initDatabase();
  const r1 = await run("UPDATE books SET fileUrl = CONCAT('/uploads/', fileUrl) WHERE fileUrl LIKE 'books/%' AND fileUrl NOT LIKE '/uploads/%'");
  console.log('Reverted books fileUrl:', r1.affectedRows);
  const r2 = await run("UPDATE books SET coverUrl = CONCAT('/uploads/', coverUrl) WHERE coverUrl LIKE 'covers/%' AND coverUrl NOT LIKE '/uploads/%'");
  console.log('Reverted books coverUrl:', r2.affectedRows);
  const r3 = await run("UPDATE users SET avatar = CONCAT('/uploads/', avatar) WHERE avatar LIKE 'avatars/%' AND avatar NOT LIKE '/uploads/%'");
  console.log('Reverted users avatar:', r3.affectedRows);
  process.exit(0);
}
main();

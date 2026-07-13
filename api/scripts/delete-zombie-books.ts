import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import { initDatabase, run, queryAll } from '../db/database.js';
import { getStorageProvider } from '../services/storage/factory.js';

async function main() {
  await initDatabase();
  const storage = getStorageProvider();

  const books = await queryAll(
    "SELECT id, title, fileUrl, coverUrl FROM books WHERE coverUrl IS NOT NULL AND coverUrl != ''"
  ) as any[];

  const toDelete: any[] = [];

  for (const b of books) {
    let fileKey: string = b.fileUrl || '';
    if (fileKey.startsWith('/uploads/')) fileKey = 'ai-library/' + fileKey.slice('/uploads/'.length);
    if (!fileKey.startsWith('ai-library/')) continue;

    const fileExists = fileKey ? await storage.exists(fileKey) : false;
    if (!fileExists) {
      toDelete.push(b);
    }
  }

  console.log(`Found ${toDelete.length} zombie books:\n`);
  for (const b of toDelete) {
    console.log(`  ${b.id} "${b.title}"`);
  }

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    process.exit(0);
  }

  console.log(`\nDeleting ${toDelete.length} records...`);

  for (const b of toDelete) {
    // Clean up cover from OSS if it exists
    let coverKey = b.coverUrl || '';
    if (coverKey.startsWith('/uploads/')) coverKey = 'ai-library/' + coverKey.slice('/uploads/'.length);

    if (coverKey.startsWith('ai-library/')) {
      try { await storage.delete(coverKey); } catch {}
    }

    // Delete related records first (foreign keys)
    await run('DELETE FROM favorites WHERE bookId = ?', [b.id]);
    await run('DELETE FROM reading_progress WHERE bookId = ?', [b.id]);
    await run('DELETE FROM reading_sessions WHERE bookId = ?', [b.id]);
    await run('DELETE FROM books WHERE id = ?', [b.id]);
    console.log(`  Deleted: ${b.title}`);
  }

  const remaining = await queryAll("SELECT COUNT(*) as cnt FROM books");
  console.log(`\nDone. Remaining books: ${(remaining[0] as any).cnt}`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

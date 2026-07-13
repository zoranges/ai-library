import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStorageProvider, buildKey } from '../services/storage/index.js';
import { queryAll, run } from '../db/database.js';
import { initDatabase } from '../db/database.js';
import { generateCoverFromBookBuffer } from '../services/bookMetadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const DRY_RUN = process.env.DRY_RUN === 'true';
const storage = getStorageProvider();

function log(msg: string) {
  console.log(`[${DRY_RUN ? 'DRY_RUN' : 'FIX'}] ${msg}`);
}

async function main() {
  console.log(`\n=== Fix Missing Covers ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  await initDatabase();

  // Find books whose cover files don't exist in OSS
  const books = await queryAll(
    "SELECT id, title, fileUrl, coverUrl FROM books WHERE coverUrl IS NOT NULL AND coverUrl != ''"
  ) as { id: string; title: string; fileUrl: string; coverUrl: string }[];

  let fixed = 0;
  let skipped = 0;

  for (const book of books) {
    // Determine OSS key for the cover
    let coverKey = book.coverUrl;
    if (coverKey.startsWith('/uploads/')) {
      coverKey = 'ai-library/' + coverKey.slice('/uploads/'.length);
    }

    const exists = await storage.exists(coverKey);
    if (exists) {
      skipped++;
      continue;
    }

    const ext = path.extname(book.fileUrl).toLowerCase();
    const format = ext === '.pdf' ? 'pdf' : ext === '.epub' ? 'epub' : null;
    if (!format) {
      log(`SKIP ${book.id} "${book.title}" — unsupported format: ${ext}`);
      continue;
    }

    log(`${book.id} "${book.title}" (${format})`);

    if (DRY_RUN) {
      fixed++;
      continue;
    }

    try {
      const bookBuffer = await storage.getObject(book.fileUrl);
      log(`  Downloaded: ${(bookBuffer.length / 1024).toFixed(1)} KB`);

      const coverBuffer = generateCoverFromBookBuffer(bookBuffer, format);
      if (!coverBuffer) {
        log(`  FAILED: could not generate cover`);
        continue;
      }
      log(`  Generated cover: ${(coverBuffer.length / 1024).toFixed(1)} KB`);

      const newCoverKey = buildKey('covers', `${book.id}.jpg`);
      await storage.upload(newCoverKey, coverBuffer, 'image/jpeg');
      log(`  Uploaded: ${newCoverKey}`);

      const result = await run('UPDATE books SET coverUrl = ? WHERE id = ?', [newCoverKey, book.id]);
      log(`  DB updated: ${result.affectedRows} rows`);
      fixed++;
    } catch (err: any) {
      log(`  FAILED: ${err.message}`);
    }
  }

  console.log(`\n=== Done: ${fixed} fixed, ${skipped} already OK ===\n`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

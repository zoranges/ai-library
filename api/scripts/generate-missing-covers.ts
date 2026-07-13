/**
 * Generate covers for all books that don't have one.
 * Downloads book from OSS, extracts first page as cover, uploads back to OSS.
 *
 * Usage:
 *   DRY_RUN=true npx tsx api/scripts/generate-missing-covers.ts
 *   npx tsx api/scripts/generate-missing-covers.ts
 */

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
  console.log(`[${DRY_RUN ? 'DRY_RUN' : 'COVER'}] ${msg}`);
}

async function main() {
  console.log(`\n=== Missing Cover Generator ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  await initDatabase();

  const books = await queryAll(
    "SELECT id, title, fileUrl FROM books WHERE (coverUrl IS NULL OR coverUrl = '') AND fileUrl IS NOT NULL AND fileUrl != ''"
  ) as { id: string; title: string; fileUrl: string }[];

  console.log(`Found ${books.length} books without covers\n`);

  let success = 0;
  let failed = 0;

  for (const book of books) {
    const ext = path.extname(book.fileUrl).toLowerCase();
    const format = ext === '.pdf' ? 'pdf' : ext === '.epub' ? 'epub' : null;
    if (!format) {
      log(`SKIP ${book.id} "${book.title}" — unsupported format: ${ext}`);
      failed++;
      continue;
    }

    log(`${book.id} "${book.title}" (${format})`);

    if (DRY_RUN) {
      success++;
      continue;
    }

    try {
      // Download book from OSS
      const bookBuffer = await storage.getObject(book.fileUrl);
      log(`  Downloaded: ${(bookBuffer.length / 1024).toFixed(1)} KB`);

      // Generate cover from first page
      const coverBuffer = generateCoverFromBookBuffer(bookBuffer, format);
      if (!coverBuffer) {
        log(`  FAILED: could not generate cover`);
        failed++;
        continue;
      }
      log(`  Generated cover: ${(coverBuffer.length / 1024).toFixed(1)} KB`);

      // Upload cover to OSS
      const coverKey = buildKey('covers', `${book.id}.jpg`);
      await storage.upload(coverKey, coverBuffer, 'image/jpeg');
      log(`  Uploaded: ${coverKey}`);

      // Update DB
      const result = await run('UPDATE books SET coverUrl = ? WHERE id = ?', [coverKey, book.id]);
      log(`  DB updated: ${result.affectedRows} rows`);
      success++;
    } catch (err: any) {
      log(`  FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Done: ${success} success, ${failed} failed ===\n`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

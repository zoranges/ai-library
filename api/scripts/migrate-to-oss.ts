/**
 * One-time migration script: upload local files to OSS and update DB records.
 *
 * Usage:
 *   DRY_RUN=true npx tsx api/scripts/migrate-to-oss.ts   # Preview without uploading
 *   npx tsx api/scripts/migrate-to-oss.ts                 # Actually migrate
 *
 * Prerequisites:
 *   - STORAGE_PROVIDER=s3 in .env
 *   - Valid OSS credentials in .env
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getStorageProvider, buildKey, keyFromLegacyPath } from '../services/storage/index.js';
import { queryAll, run } from '../db/database.js';
import { initDatabase } from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const DRY_RUN = process.env.DRY_RUN === 'true';
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

const storage = getStorageProvider();

function log(msg: string) {
  console.log(`[${DRY_RUN ? 'DRY_RUN' : 'MIGRATE'}] ${msg}`);
}

async function migrateDirectory(
  dirPath: string,
  subfolder: string,
  queryUpdater: (legacyPath: string, ossKey: string) => Promise<number>,
) {
  const fullPath = path.join(dirPath, subfolder);
  if (!fs.existsSync(fullPath)) {
    log(`Directory not found: ${fullPath} — skipping`);
    return 0;
  }

  const files = fs.readdirSync(fullPath, { withFileTypes: true });
  let count = 0;

  for (const entry of files) {
    if (!entry.isFile()) continue;

    const filename = entry.name;
    const filePath = path.join(fullPath, filename);
    const legacyPath = `/uploads/${subfolder}/${filename}`;
    const ossKey = `ai-library/${subfolder}/${filename}`;

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        log(`  SKIP: file not found on disk — ${filePath}`);
        continue;
      }
      throw err;
    }

    log(`  ${legacyPath} → ${ossKey} (${(stat.size / 1024).toFixed(1)} KB)`);

    if (!DRY_RUN) {
      try {
        const buffer = fs.readFileSync(filePath);
        const mimeType = guessMimeType(filename);
        await storage.upload(ossKey, buffer, mimeType);
        const updated = await queryUpdater(legacyPath, ossKey);
        if (updated === 0) {
          log(`  → WARNING: uploaded but 0 DB rows matched ${legacyPath}`);
        } else {
          log(`  → OK, ${updated} DB rows updated`);
        }
      } catch (err: any) {
        console.error(`  → FAILED: ${err.message}`);
        continue;
      }
    }
    count++;
  }

  return count;
}

function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.epub': 'application/epub+zip',
    '.pdf': 'application/pdf',
    '.mobi': 'application/x-mobipocket-ebook',
    '.txt': 'text/plain',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

async function main() {
  console.log(`\n=== OSS Migration Tool ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
  console.log(`Provider: ${process.env.STORAGE_PROVIDER}`);
  console.log(`Bucket: ${process.env.STORAGE_S3_BUCKET}\n`);

  await initDatabase();

  // 1. Books
  console.log('── [1/4] Migrating book files ──');
  const bookCount = await migrateDirectory(UPLOADS_ROOT, 'books', async (legacyPath, ossKey) => {
    const result = await run('UPDATE books SET fileUrl = ? WHERE fileUrl = ?', [ossKey, legacyPath]);
    return result.affectedRows || 0;
  });
  console.log(`  Books: ${bookCount} files`);

  // 2. Covers
  console.log('\n── [2/4] Migrating cover images ──');
  const coverCount = await migrateDirectory(UPLOADS_ROOT, 'covers', async (legacyPath, ossKey) => {
    const result = await run('UPDATE books SET coverUrl = ? WHERE coverUrl = ?', [ossKey, legacyPath]);
    return result.affectedRows || 0;
  });
  console.log(`  Covers: ${coverCount} files`);

  // 3. Avatars
  console.log('\n── [3/4] Migrating avatars ──');
  const avatarCount = await migrateDirectory(UPLOADS_ROOT, 'avatars', async (legacyPath, ossKey) => {
    const result = await run('UPDATE users SET avatar = ? WHERE avatar = ?', [ossKey, legacyPath]);
    return result.affectedRows || 0;
  });
  console.log(`  Avatars: ${avatarCount} files`);

  // 4. Pages
  console.log('\n── [4/4] Migrating page images ──');
  const pageCount = await migrateDirectory(UPLOADS_ROOT, 'pages', async (legacyPath, ossKey) => {
    const result = await run('UPDATE system_config SET configValue = ? WHERE configValue = ?', [ossKey, legacyPath]);
    return result.affectedRows || 0;
  });
  console.log(`  Pages: ${pageCount} files`);

  console.log(`\n=== ${DRY_RUN ? 'DRY RUN complete (no changes made)' : 'Migration complete'} ===`);
  console.log(`Total: ${bookCount + coverCount + avatarCount + pageCount} files processed\n`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

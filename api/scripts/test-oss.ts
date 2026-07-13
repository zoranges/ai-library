import OSS from 'ali-oss';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const store = new OSS({
    region: process.env.STORAGE_S3_REGION!,
    accessKeyId: process.env.STORAGE_S3_ACCESS_KEY!,
    accessKeySecret: process.env.STORAGE_S3_SECRET_KEY!,
    bucket: 'pdf-upload-2',
  });

  // List and delete all root-level objects (books/ and covers/ that were already uploaded)
  console.log('Listing current objects...');
  const toDelete: string[] = [];
  for (const prefix of ['books/', 'covers/', 'test/']) {
    let marker: string | undefined;
    do {
      const r = await store.list({ prefix, marker, 'max-keys': 1000 }, {});
      for (const obj of r.objects || []) {
        if (obj.name) {
          toDelete.push(obj.name);
          console.log('  Found:', obj.name);
        }
      }
      marker = r.nextMarker || undefined;
    } while (marker);
  }

  console.log(`\nTotal objects to delete: ${toDelete.length}`);
  if (toDelete.length > 0) {
    console.log('Deleting...');
    // Delete in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      await store.deleteMulti(batch, { quiet: true });
      console.log(`  Deleted batch ${i / batchSize + 1}: ${batch.length} objects`);
    }
    console.log('Done!');
  }
}

main();
